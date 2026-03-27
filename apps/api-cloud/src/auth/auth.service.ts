import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import * as schema from '@omr-prod/database';

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
    private readonly jwtService: JwtService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const [user] = await this.db.select().from(schema.users)
      .where(and(
        eq(schema.users.email, email),
        eq(schema.users.isActive, true)
      ))
      .limit(1);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    try {
      const payload = { sub: user.id, email: user.email, type: 'access' };
      const refreshPayload = { sub: user.id, type: 'refresh' };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

      const salt = await bcrypt.genSalt(10);
      const tokenHash = await bcrypt.hash(refreshToken, salt);

      await this.db.insert(schema.refreshTokens).values({
        userId: user.id,
        tokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return {
        accessToken,
        refreshToken,
        user
      };
    } catch (err) {
      console.error('❌ Login error in AuthService:', err);
      throw err;
    }
  }

  async refresh(token: string) {
    try {
      console.log('🔄 [AuthService] Refreshing token...', token.substring(0, 20) + '...');
      const payload = this.jwtService.verify(token);
      console.log('✅ [AuthService] JWT Verified. Payload:', payload);

      if (payload.type !== 'refresh') {
        console.error('❌ [AuthService] Invalid token type:', payload.type);
        throw new UnauthorizedException('Invalid token type');
      }

      // 1. Fetch all tokens for this user
      const dbTokens = await this.db.select().from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.userId, payload.sub));

      console.log(`🔍 [AuthService] Found ${dbTokens.length} tokens in DB for user ${payload.sub}`);

      // 2. Find the matching token hash
      let matchedToken: any = null;
      for (const t of dbTokens) {
        if (await bcrypt.compare(token, t.tokenHash)) {
          matchedToken = t;
          break;
        }
      }

      if (!matchedToken) {
        console.error('❌ [AuthService] No matching token hash found in DB');
        throw new UnauthorizedException('Token revoked or expired');
      }
      if (matchedToken.expiresAt < new Date()) {
        console.error('❌ [AuthService] Token expired in DB:', matchedToken.expiresAt);
        throw new UnauthorizedException('Token revoked or expired');
      }

      console.log('✅ [AuthService] Token matched in DB');

      const [user] = await this.db.select().from(schema.users)
        .where(and(eq(schema.users.id, payload.sub), eq(schema.users.isActive, true)))
        .limit(1);
      if (!user) {
        console.error('❌ [AuthService] User no longer active or exists');
        throw new UnauthorizedException('User no longer active');
      }

      // 3. Optional: Revoke the used refresh token (Rotation)
      // Removed rotation for session stability. Multiple refreshes shouldn't invalidate the session unless implemented with re-issuance.

      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        type: 'access'
      });

      console.log('🚀 [AuthService] Successfully issued new access token');
      return { accessToken: newAccessToken };
    } catch (err) {
      console.error('💥 [AuthService] Refresh error:', err);
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Session expired');
    }
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      // Reject non-access tokens (e.g. a refresh token used as an access token)
      if (payload.type !== 'access') return null;

      const [user] = await this.db.select().from(schema.users)
        .where(and(eq(schema.users.id, payload.sub), eq(schema.users.isActive, true)))
        .limit(1);

      return user ?? null;
    } catch {
      return null;
    }
  }
}
