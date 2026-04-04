import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigType } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  redisConfig,
} from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // ─── ConfigModule ─────────────────────────────────────────────────────
    // isGlobal: true → disponible en TODOS los módulos sin importarlo de nuevo
    // envFilePath: busca el archivo .env en la raíz del proyecto
    // load: registra las funciones de configuración tipadas
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'], // Prioridad: .env.local > .env
      load: [databaseConfig, redisConfig, appConfig],
      // validationSchema: Joi.object({ ... })  // ← Agrega validación con Joi mas adelante :v
    }),

    // ─── TypeOrmModule ────────────────────────────────────────────────────
    // forRootAsync: permite usar ConfigService (que lee variables de entorno)
    // DEBE ser forRootAsync (no forRoot) cuando las opciones vienen de config
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY], // ← Usa el token tipado en vez de ConfigService
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        ...dbConfig, //TypeScript sabe exactamente qué tipo es, sin warnings
      }),
    }),

    // ─── Módulos de la aplicación ─────────────────────────────────────────
    UsersModule, // Módulo de usuarios con cache Redis configurado
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
