import 'dotenv/config'; // carga backend/.env en process.env para el runtime
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS para el frontend (Vite)
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend HVC en http://localhost:${port}`);
}
bootstrap();
