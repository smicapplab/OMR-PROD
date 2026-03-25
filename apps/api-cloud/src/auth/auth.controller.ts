import { Controller, Post, Body, Res, Req, UnauthorizedException, Get, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {
    if (!this.authService) {
        console.error('❌ AuthService was not injected into AuthController');
    }
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    if (!this.authService) throw new Error('AuthService missing');
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.authService.login(user);

    res.cookie('omr_cloud_refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: tokens.accessToken,
      user: tokens.user,
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request) {
    const token = req.cookies['omr_cloud_refresh'];
    if (!token) throw new UnauthorizedException();
    return this.authService.refresh(token);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('omr_cloud_refresh', { path: '/api/v1/auth/refresh' });
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();
    
    const token = authHeader.split(' ')[1];
    const user = await this.authService.verifyToken(token);
    if (!user) throw new UnauthorizedException();

    return user;
  }
}
