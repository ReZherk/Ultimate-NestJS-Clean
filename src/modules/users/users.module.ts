import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';

import { UserService } from './application/services/user.service';
import { UserTypeOrmRepository } from './infrastructure/user.typeorm.repository';
import { UserEntity } from './domain/entities/user.entity';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [
    // CacheModule: configura Redis para este módulo
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: 'ioredis', // Usa ioredis (ya instalado: cache-manager-ioredis-yet)
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD') || undefined,
        db: configService.get<number>('REDIS_DB', 0),
        ttl: configService.get<number>('REDIS_TTL', 300), // 5 minutos por defecto
      }),
    }),

    // TypeORM: registra la entidad UserEntity
    TypeOrmModule.forFeature([UserEntity]),
  ],

  // Controller: endpoints HTTP
  controllers: [UsersController],

  // Provider: implementación concreta del repository (inyectada por token)
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeOrmRepository,
    },
    UserService,
  ],

  // Exporta el servicio para que otros módulos (como AppModule) puedan usarlo
  exports: [UserService],
})
export class UsersModule {}
