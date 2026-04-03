# Dependencias Instaladas - Guía Rápida

Este documento explica las dependencias instaladas en el proyecto y su propósito principal.

---

## Base de Datos

### `@nestjs/typeorm` y `typeorm`
**¿Qué es?** ORM (Object-Relational Mapping) que permite trabajar con bases de datos relacionales usando objetos TypeScript.

**¿Qué problema resuelve?** Evita escribir SQL manualmente y facilita la manipulación de datos convirtiendo tablas en clases.

**Ejemplo práctico:**
```typescript
// Sin TypeORM - SQL manual
const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);

// Con TypeORM
const user = await userRepository.find({ where: { id } });
```

---

### `pg`
**¿Qué es?** Cliente de PostgreSQL para Node.js.

**¿Qué problema resuelve?** Permite conexión directa con PostgreSQL, la base de datos más popular para aplicaciones escalables.

**Ejemplo de uso:**
```typescript
// Conecta a PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'mydb'
});
```

---

## Configuración y Validación

### `@nestjs/config`
**¿Qué es?** Módulo de NestJS para manejar variables de entorno de forma segura.

**¿Qué problema resuelve?** Centraliza la configuración de la aplicación (API keys, DB credentials, etc.) fuera del código.

**Ejemplo:**
```typescript
// .env
DATABASE_HOST=localhost
JWT_SECRET=mySecret

// En el código
@Injectable()
export class AppService {
  constructor(private config: ConfigService) {
    const dbHost = this.config.get<string>('DATABASE_HOST');
    const jwtSecret = this.config.get<string>('JWT_SECRET');
  }
}
```

---

### `class-validator` y `class-transformer`
**¿Qué es?** Librerías para validar y transformar objetos TypeScript usando decoradores.

**¿Qué problema resuelve?** Validación automática de datos de entrada (DTOs) y transformación entre JSON y objetos.

**Ejemplo:**
```typescript
// Definir reglas de validación
class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsNumber()
  age: number;
}

// Validación automática en el controlador
@Post()
async create(@Body() createUserDto: CreateUserDto) {
  // Si no es válido, NestJS responde automáticamente con error 400
  return this.usersService.create(createUserDto);
}
```

---

## Caché y Rendimiento

### `@nestjs/cache-manager`, `cache-manager` y `cache-manager-ioredis-yet`
**¿Qué es?** Sistema de caché multi-backend (memoria, Redis, etc.) para NestJS.

**¿Qué problema resuelve?** Acelera la aplicación almacenando temporalmente consultas frecuentes o resultados costosos.

**Ejemplo:**
```typescript
// Cachear resultados de consulta pesada
@Cacheable('users', { ttl: 60 }) // 60 segundos
async findAllUsers() {
  return this.userRepository.find();
}

// Limpiar cache cuando hay cambios
@CacheKey('users')
async updateUser(id: number, dto: UpdateUserDto) {
  const user = await this.userRepository.update(id, dto);
  this.cacheManager.reset('users'); // Invalidar cache
  return user;
}
```

---

### `ioredis`
**¿Qué es?** Cliente Redis robusto y de alto rendimiento.

**¿Qué problema resuelve?** Proporciona almacenamiento en memoria ultrarrápido y persistente para sesiones, colas, o caché distribuida.

**Ejemplo:**
```typescript
// Guardar sesión de usuario
await redis.set(`session:${userId}`, JSON.stringify(session), 'EX', 3600);

// Obtener datos cacheados
const cached = await redis.get('products:all');
if (cached) return JSON.parse(cached);

// Cola de tareas
await redis.rpush('email-queue', JSON.stringify({ to: 'user@email.com' }));
```

---

## API y Documentación

### `@nestjs/swagger`
**¿Qué es?** Integración de Swagger/OpenAPI para NestJS.

**¿Qué problema resuelve?** Genera automáticamente documentación interactiva de la API REST.

**Ejemplo:**
```typescript
// Documentación automática desde decoradores
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}

// Acceder a: http://localhost:3000/api/docs (interactivo)
```

---

## Seguridad

### `bcrypt`
**¿Qué es?** Librería para hashear contraseñas de forma segura.

**¿Qué problema resuelve?** Protege contraseñas de usuarios almacenándolas con hash (nunca en texto plano).

**Ejemplo:**
```typescript
import * as bcrypt from 'bcrypt';

// Registrar usuario
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);
await userRepository.save({ email, password: hashedPassword });

// Verificar login
const isValid = await bcrypt.compare(inputPassword, storedHash);
if (!isValid) throw new UnauthorizedException();
```

---

### `uuid`
**¿Qué es?** Generador de UUIDs (identificadores únicos universales).

**¿Qué problema resuelve?** Crea IDs únicos sin colisiones para registros, tokens, o cualquier recurso.

**Ejemplo:**
```typescript
import { v4 as uuidv4 } from 'uuid';

// En lugar de IDs secuenciales (1, 2, 3)
const userId = uuidv4(); // '3b12f1df-5232-4c0a-9d6b-8c7d1e9a2f3b'
const orderId = uuidv4();

// Más seguro para URLs públicas
const product: Product = {
  id: uuidv4(),
  name: 'Laptop',
  price: 999
};
```

---

## Tipos de TypeScript

### `@types/bcrypt` y `@types/uuid`
**¿Qué son?** Definiciones de tipos TypeScript para las librerías `bcrypt` y `uuid`.

**¿Qué problema resuelven?** Proporcionan autocompletado, validación de tipos y mejor experiencia de desarrollo al usar estas librerías en TypeScript, ya que originalmente están escritas en JavaScript.

**Nota importante:** Estos paquetes no se incluyen en producción. Son **dependencias de desarrollo (devDependencies)** que únicamente se usan durante el desarrollo para que TypeScript entienda los tipos de estas librerías.

**Ejemplo de beneficio:**
```typescript
import * as bcrypt from 'bcrypt';

// Con @types/bcrypt, TypeScript conoce:
// - Parámetros de bcrypt.hash(password, saltRounds)
// - Valor de retorno Promise<string>
// - Métodos disponibles

const hashed = await bcrypt.hash('password', 10);
//      ^? TypeScript sabe que devuelve string

const isValid = await bcrypt.compare('input', hashed);
//      ^? TypeScript sabe que devuelve boolean
```

---

## Resumen de Casos de Uso

| Dependencia | Caso de Uso Principal |
|-------------|----------------------|
| TypeORM | Acceso a base de datos con objetos |
| Config | Manejo seguro de variables de entorno |
| Class-validator | Validación automática de DTOs |
| Cache-manager | Optimizar consultas repetitivas |
| Swagger | Documentación API automática |
| Bcrypt | Hash seguro de contraseñas |
| UUID | IDs únicos para registros |

---

**Nota:** Estas dependencias forman un stack completo para construir una API REST robusta y escalable con NestJS, cubriendo base de datos, validación, seguridad, caché y documentación.
