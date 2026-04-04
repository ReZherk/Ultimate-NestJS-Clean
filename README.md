<div align="center">

# 🚀 Ultimate NestJS Clean

**Una API REST completa para gestión de usuarios con arquitectura limpia, cache Redis y TypeScript**

[![NestJS](https://img.shields.io/badge/NestJS-EA4E39?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 📋 📋 Sobre el Proyecto

**Ultimate NestJS Clean** es un proyecto de aprendizaje que implementa una API REST para gestión de usuarios siguiendo los principios de **Clean Architecture** y **Domain-Driven Design (DDD)**.

### ✨ Características principales

- ✅ **Arquitectura Limpia** (Clean Architecture) con separación de responsabilidades
- ✅ **Patrón Repository** para abstraer la persistencia de datos
- ✅ **Cache Redis** para optimización de consultas (200x más rápido)
- ✅ **TypeScript** con tipado completo y estricto
- ✅ **TypeORM** como ORM para PostgreSQL
- ✅ **Swagger/OpenAPI** con documentación interactiva
- ✅ **Patrón Result** para manejo robusto de errores
- ✅ **Validación de datos** con class-validator
- ✅ **Docker** + Docker Compose para desarrollo containerizado
- ✅ **Soft Delete** (eliminación lógica)
- ✅ **Paginación y filtros** avanzados
- ✅ **Logging estructurado** con NestJS Logger

---

## 🏗️ Arquitectura

El proyecto sigue **Clean Architecture** (también conocida como Hexagonal Architecture):

```
src/
├── modules/
│   └── users/                    # Módulo de usuarios
│       ├── application/          # ⚙️  Casos de uso (services)
│       │   └── services/
│       │       └── user.service.ts
│       ├── domain/              # 🔵 Entidades e interfaces (negocio puro)
│       │   ├── entities/
│       │   │   └── user.entity.ts
│       │   └── repositories/
│       │       └── user.repository.interface.ts
│       ├── infrastructure/      # 🟢 Implementaciones técnicas (DB, cache)
│       │   └── user.typeorm.repository.ts
│       ├── presentation/        # 🟡 Controladores (API HTTP)
│       │   └── controllers/
│       │       └── users.controller.ts
│       ├── dto/                 # 📦 Data Transfer Objects
│       │   └── user.dto.ts
│       ├── users.module.ts      # Módulo NestJS
│       └── users.controller.ts  # (legacy - movido a presentation/)
├── common/                      # Utilidades compartidas
│   └── result/
│       └── result.ts           # Patrón Result<T>
├── config/
│   └── database.config.ts      # Configuraciones tipadas
├── app.module.ts               # Módulo raíz
└── main.ts                     # Bootstrap de la aplicación
```

### 📊 Capas de la arquitectura

| Capa | Color | Responsabilidad | Dependencias |
|------|-------|-----------------|--------------|
| **Domain** | 🔵 | Lógica de negocio pura, entidades, contratos | Ninguna (pura) |
| **Application** | ⚙️ | Casos de uso, orquestación | Domain |
| **Infrastructure** | 🟢 | Persistencia, cache, APIs externas | Application, Domain |
| **Presentation** | 🟡 | Controladores, DTOs, validación | Application, Domain |

**Regla de oro**: Las dependencias SOLO apuntan hacia adentro (Infrastructure → Application → Domain). Nunca al revés.

---

## 🚀 Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **NestJS** | ^11.0.1 | Framework Node.js |
| **TypeScript** | ^5.7.3 | Lenguaje tipado |
| **PostgreSQL** | 15-alpine | Base de datos principal |
| **TypeORM** | ^0.3.28 | ORM |
| **Redis** | 7-alpine | Cache de consultas |
| **Docker & Docker Compose** | - | Orquestación de servicios |
| **Swagger/OpenAPI** | ^11.2.6 | Documentación API |
| **class-validator** | ^0.14.4 | Validación de DTOs |
| **class-transformer** | ^0.5.1 | Transformación de datos |
| **bcrypt** | ^6.0.0 | Hash de contraseñas |
| **uuid** | ^13.0.0 | Generación de UUIDs |
| **cache-manager** | ^7.2.8 | Cache abstraction |
| **cache-manager-ioredis-yet** | ^2.1.2 | Redis store para cache-manager |

---

## 📦 Estructura del Módulo Users

### Entities (Dominio)

```typescript
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string; // hasheada con bcrypt

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null; // Soft delete

  @BeforeInsert()
  async beforeInsert() {
    if (!this.id) this.id = uuidv4();
    if (this.email) this.email = this.email.toLowerCase().trim();
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }
}
```

### Repository Interface (Contrato)

```typescript
export interface IUserRepository {
  create(user: UserEntity): AsyncResult<UserEntity>;
  findById(id: string): AsyncResult<UserEntity>;
  findByEmail(email: string): AsyncResult<UserEntity | null>;
  findAll(
    pagination: PaginationOptions,
    filters?: UserFilters,
  ): AsyncResult<PaginatedResult<UserEntity>>;
  update(id: string, partial: Partial<UserEntity>): AsyncResult<UserEntity>;
  softDelete(id: string): AsyncResult<void>;
  hardDelete(id: string): AsyncResult<void>;
  existsByEmail(email: string): AsyncResult<boolean>;
  count(filters?: UserFilters): AsyncResult<number>;
}
```

### Service (Casos de Uso)

El `UserService` implementa toda la lógica de negocio:

- ✅ Validación de email único
- ✅ Cache Redis con patrón Cache-Aside
- ✅ Invalidación automática en update/delete
- ✅ Transformación Entity → DTO
- ✅ Manejo robusto de errores con `Result<T>`

**Cache Strategy**:

| Operación | Cache Key | TTL | Invalidación |
|-----------|-----------|-----|--------------|
| `findUserById` | `users:{id}` | 300s (5 min) | Auto en update/delete |
| `findAllUsers` | `users:list:{JSON(query)}` | 60s (1 min) | Expiración automática |

### Controller (API REST)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/users` | Crear usuario |
| `GET` | `/users/:id` | Obtener usuario por ID (con cache) |
| `GET` | `/users` | Listar usuarios (paginado, filtrado, cacheado) |
| `PATCH` | `/users/:id` | Actualizar usuario (invalida cache) |
| `DELETE` | `/users/:id` | Eliminar usuario (soft delete, invalida cache) |

---

## 🔧 Instalación y Configuración

### Requisitosprevios

- **Node.js** >= 18.x
- **Docker** & Docker Compose (opcional pero recomendado)
- **Redis CLI** (para debugging)

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd Ultimate-NestJS-Clean
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

El archivo `.env` ya está configurado para desarrollo local:

```env
# App
NODE_ENV=development
PORT=3000
APP_NAME="NestJS Learning"
API_PREFIX=api

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=nestuser
DB_PASSWORD=nestpassword
DB_DATABASE=nestdb
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Redis (Cache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=300
REDIS_DB=0

# JWT (para futuro)
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
JWT_EXPIRES_IN=7d
```

### 4. Levantar servicios con Docker (recomendado)

```bash
# Levanta PostgreSQL + Redis + PgAdmin
docker-compose up -d

# Verificar que estén corriendo
docker-compose ps
# Deberías ver: postgres (healthy), redis (healthy), pgadmin (up)
```

**Servicios disponibles**:

| Servicio | Puerto | Credenciales | URL |
|----------|--------|--------------|-----|
| PostgreSQL | 5432 | nestuser / nestpassword | `localhost:5432` |
| Redis | 6379 | (sin contraseña) | `localhost:6379` |
| PgAdmin | 5050 | admin@admin.com / admin | http://localhost:5050 |

### 5. Inicializar la base de datos

La BD se crea automáticamente cuando levantas Docker. TypeORM con `DB_SYNCHRONIZE=true` crea las tablas al iniciar la app.

---

## 🏃 Ejecución

### Desarrollo (con hot-reload)

```bash
npm run start:dev
```

La aplicación estará disponible en: **http://localhost:3000**

### Producción

```bash
npm run build
npm run start:prod
```

---

## 📚 Documentación API (Swagger)

Una vez que la aplicación esté corriendo, abre:

**Swagger UI**: http://localhost:3000/api-docs

Ahí encontrarás:

- 📝 **Documentación completa** de todos los endpoints
- 🧪 **"Try it out"** para probar la API directamente
- 📦 **Modelos de request/response** con ejemplos
- 🔐 **Autenticación JWT** configurada (para futuro)
- 🏷️ **Tags** organizados por módulo

### Endpoints Disponibles

#### Users

| Método | Endpoint | Descripción | Cache |
|--------|----------|-------------|-------|
| `POST` | `/users` | Crear usuario | ❌ No |
| `GET` | `/users/:id` | Obtener por ID | ✅ Sí (5 min) |
| `GET` | `/users` | Listar (paginado) | ✅ Sí (1 min) |
| `PATCH` | `/users/:id` | Actualizar | ❌ Invalida cache |
| `DELETE` | `/users/:id` | Eliminar (soft) | ❌ Invalida cache |

#### Ejemplos de uso

**Crear usuario**:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com",
    "password": "MiClaveSegura123!"
  }'
```

**Obtener usuario**:

```bash
curl http://localhost:3000/users/:id
```

**Listar usuarios**:

```bash
# Todos
curl http://localhost:3000/users?page=1&limit=10

# Con filtros
curl "http://localhost:3000/users?page=1&limit=10&role=admin&isActive=true&search=Juan"
```

**Actualizar usuario**:

```bash
curl -X PATCH http://localhost:3000/users/:id \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Juan Carlos",
    "isActive": false
  }'
```

**Eliminar usuario** (soft delete):

```bash
curl -X DELETE http://localhost:3000/users/:id
```

---

## 🗄️ Base de Datos (PostgreSQL)

### Esquema de la tabla `users`

```sql
CREATE TABLE users (
  "id" UUID PRIMARY KEY,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password" VARCHAR(255) NOT NULL,
  "role" USER_ROLE NOT NULL DEFAULT 'user',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL
);

CREATE INDEX "IDX_users_email" ON "users"("email");
```

**Enums**:
```sql
CREATE TYPE user_role AS ENUM ('admin', 'user', 'moderator');
```

### Acceder a la base de datos

**Via Docker**:
```bash
docker-compose exec postgres psql -U nestuser -d nestdb
```

**Via PgAdmin**:
1. Abre http://localhost:5050
2. Email: `admin@admin.com`
3. Password: `admin`
4. Agrega servidor:
   - Host: `localhost`
   - Port: `5432`
   - Username: `nestuser`
   - Password: `nestpassword`
   - Database: `nestdb`

---

## ⚡ Redis (Cache)

### ¿Qué se cachea?

1. **Usuario individual** (`GET /users/:id`)
   - Key: `users:{id}`
   - TTL: 300 segundos (5 minutos)
   - Se invalida en `PATCH` y `DELETE`

2. **Lista de usuarios** (`GET /users`)
   - Key: `users:list:{JSON.stringify(query)}`
   - TTL: 60 segundos (1 minuto)
   - Expira automáticamente

### Verificar que Redis funciona

```bash
# 1. Conectar a Redis
redis-cli ping
# Debería responder: PONG

# 2. Ver todas las claves de usuarios
redis-cli KEYS "users:*"

# 3. Ver valor de una clave específica
redis-cli GET "users:<id>"

# 4. Ver TTL de una clave
redis-cli TTL "users:<id>"
# -2 = expirada, -1 = sin expiración, número = segundos restantes

# 5. Monitorear en tiempo real (en otra terminal)
redis-cli monitor
```

### Comandos útiles

```bash
# Limpiar toda la DB de Redis (cuidado en producción!)
docker-compose exec redis redis-cli FLUSHDB

# Ver estadísticas de Redis
docker-compose exec redis redis-cli INFO stats
```

---

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests en watch mode
npm run test:watch

# Tests de cobertura
npm run test:cov

# Tests e2e
npm run test:e2e
```

---

## 🔍 Debugging

### Ver logs detallados

En `user.service.ts` ya hay logs en cada operación:

```typescript
this.logger.log(`Usuario creado: ${responseDto.id}`);
this.logger.debug(`Cache HIT: ${cacheKey}`);
this.logger.debug(`Cache MISS: ${cacheKey} → consultando BD`);
this.logger.warn(`Error invalidando cache para usuario ${id}`);
```

Verás en consola:
```
[Nest] 12345 - 04/04/2026, HH:MM:SS AM   LOG [UserService] Usuario creado: abc123...
[Nest] 12345 - 04/04/2026, HH:MM:SS AM   DEBUG [UserService] Cache HIT: users:abc123...
```

### Ver queries SQL de TypeORM

En `.env`:
```env
DB_LOGGING=true
```

Verás todas las queries SQL generadas en consola.

---

## 📖 Recursos de Aprendizaje

### Dentro del proyecto

- **[REDIS.md](./REDIS.md)** - Guía completa de Redis en este proyecto
- **Comentarios en código** - Cada archivo está extensamente documentado
- **Estructura Clean Architecture** - Aprende separación de capas

### Externos

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Redis Documentation](https://redis.io/docs)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

## 🎯 Próximos Pasos (Mejoras Sugeridas)

- [ ] **Autenticación JWT** (login, register, guards)
- [ ] **Tests unitarios y e2e** completos
- [ ] **Migraciones** TypeORM (en lugar de `synchronize: true`)
- [ ] **Rate limiting** ( throttling )
- [ ] **Interceptors** para logging global
- [ ] **Filtros de excepciones** personalizados
- [ ] **Health checks** (`/health`) para monitoreo
- [ ] **Metrics** (Prometheus + Grafana)
- [ ] **Cache Tags** para invalidación por colección
- [ ] **Event Sourcing** con Redis Streams
- [ ] **Testing con mocks** de Redis
- [ ] **CI/CD** pipeline (GitHub Actions)

---

## 📄 License

Este proyecto está bajo la licencia MIT. Ver [LICENSE](./LICENSE) para más detalles.

---

## 👨‍💻 Autor

**ReZherk** - [GitHub](https://github.com/ReZherk)

---

## 🙌 Agradecimientos

- [NestJS](https://nestjs.com) - Framework increíble
- [Kamil Myśliwiec](https://twitter.com/kammysliwiec) - Creador de NestJS
- Comunidad de NestJS en [Discord](https://discord.gg/G7Qnnhy)

---

<div align="center">
  <sub>Hecho con ❤️ y TypeScript</sub>
</div>
