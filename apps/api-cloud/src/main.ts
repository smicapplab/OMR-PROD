import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const cookieParserFunc = (cookieParser as any).default || cookieParser;
  app.use(cookieParserFunc());

  // Security headers (without helmet dependency — set manually)
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    next();
  });

  // CORS: allow origins from environment or safe localhost defaults
  const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api/v1');

  let storagePath = join(process.cwd(), 'cloud_storage');
  if (!existsSync(storagePath)) {
    storagePath = join(process.cwd(), 'apps', 'api-cloud', 'cloud_storage');
  }

  app.useStaticAssets(storagePath, {
    prefix: '/cloud-assets',
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  console.log(`🚀 Cloud Hub API running on port ${port}`);
}
bootstrap();
