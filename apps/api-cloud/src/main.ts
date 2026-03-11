import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const cookieParserFunc = (cookieParser as any).default || cookieParser;
  app.use(cookieParserFunc());
  
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix('api/v1');

  app.useStaticAssets(join(__dirname, '..', 'cloud_storage'), {
    prefix: '/cloud-assets',
  });

  await app.listen(4000);
  console.log(`🚀 Cloud Hub API running on: http://localhost:4000/api/v1`);
}
bootstrap();
