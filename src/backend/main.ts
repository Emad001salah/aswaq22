import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend integration
  app.enableCors();
  
  // Use global pipes for better validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Match the platform port requirement internally (Proxy handled by Next.js)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
  const host = '127.0.0.1';
  await app.listen(port, host);
  console.log(`NestJS Backend is running on http://${host}:${port}`);
}
bootstrap();
