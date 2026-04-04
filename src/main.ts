import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Configuración de Swagger (API Documentation) ─────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('API Users') // Título en la página de Swagger
    .setDescription('API para gestión de usuarios con cache Redis') // Descripción
    .setVersion('1.0') // Versión de la API
    .addBearerAuth() // ← Agrega botón "Authorize" para JWT tokens
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Ruta: http://localhost:3000/api-docs
  SwaggerModule.setup('api-docs', app, document);

  // ─── Puerto ───────────────────────────────────────────────────────────────────
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
