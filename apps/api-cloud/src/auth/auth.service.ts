import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as schema from '@omr-prod/database';

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
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
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'refresh') throw new UnauthorizedException();

      const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1);
      if (!user) throw new UnauthorizedException();

      const newAccessToken = this.jwtService.sign({ 
        sub: user.id, 
        email: user.email, 
        type: 'access' 
      });

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException();
    }
  }

  async verifyToken(token: string) {
    try {
        const payload = this.jwtService.verify(token);
        const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1);
        return user;
    } catch {
        return null;
    }
  }
}
