import { registerAs } from '@nestjs/config'; // registerAs: crea un namespace de config
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de base de datos
// registerAs('database', ...) crea un token 'database' para inyección de deps
// ─────────────────────────────────────────────────────────────────────────────
export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres', // Driver: postgres, mysql, sqlite, mongodb...

    // Conexión: lee de variables de entorno con fallbacks para desarrollo
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10), // Convierte string → number
    username: process.env.DB_USERNAME ?? 'nestuser',
    password: process.env.DB_PASSWORD ?? 'nestpassword',
    database: process.env.DB_DATABASE ?? 'nestdb',

    // Entidades: TypeORM detecta automáticamente todas las entidades con @Entity()
    // __dirname + patrón glob: busca en src/modules/**/entities/*.entity.ts
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],

    // Migrations: archivos de migración para cambios de schema en producción
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],

    // SYNCHRONIZE: Solo en desarrollo
    // true  → TypeORM actualiza el schema automáticamente con las entidades
    // false → Debes usar migraciones (OBLIGATORIO en producción)
    synchronize: process.env.DB_SYNCHRONIZE === 'true',

    // Logging: muestra las queries SQL en consola
    // Muy útil para aprender qué SQL genera TypeORM
    logging: process.env.DB_LOGGING === 'true',

    // SSL para conexiones seguras (Heroku, AWS RDS, etc.)
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false } // En algunos proveedores necesitas esto
        : false,

    // Pool de conexiones: cuántas conexiones simultáneas a PostgreSQL
    extra: {
      max: 10, // Máximo de conexiones en el pool
      min: 2, // Mínimo siempre activas
      idleTimeoutMillis: 30000, // Cierra conexiones idle después de 30s
      connectionTimeoutMillis: 5000, // Timeout al obtener conexión del pool
    },
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de Redis (para cache)
// ─────────────────────────────────────────────────────────────────────────────
export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? undefined, // undefined = sin contraseña
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  ttl: parseInt(process.env.REDIS_TTL ?? '300', 10), // 5 minutos por defecto
}));

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de la aplicación
// ─────────────────────────────────────────────────────────────────────────────
export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'NestJS Learning',
  environment: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
}));
