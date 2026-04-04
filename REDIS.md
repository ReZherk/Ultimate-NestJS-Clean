# 🗄️ Redis en el Proyecto - Guía Rápida

## 📖 ¿Qué es Redis?

**Redis** (Remote Dictionary Server) es una base de datos **en memoria** (in-memory) extremadamente rápida que funciona como un **cache** o almacenamiento clave-valor.

### Características principales:
- ⚡ **Velocidad**: Operaciones en ~0.1ms (vs ~5-50ms de una BD tradicional)
- 💾 **Estructuras de datos**: Strings, Hash, Lists, Sets, Sorted Sets
- 🔄 **Persistencia opcional**: Puede guardar datos en disco (AOF/RDB)
- 📦 **Lightweight**: Muy poco consumo de recursos
- 🎯 **Uso principal**: Cache de consultas frecuentes, sesiones, colas

---

## 🎯 ¿Por qué usar Redis en este proyecto?

**Problema**: Cada vez que un cliente pide un usuario (`GET /users/:id`), consultamos la base de datos PostgreSQL, que es relativamente lento.

**Solución**: Guardamos los usuarios ya consultados en Redis (cache). La siguiente vez que pidan el mismo usuario, lo devolvemos desde Redis en ~0.1ms en lugar de ~20ms.

```
Sin cache:   Cliente → API → PostgreSQL (20ms) → API → Cliente
Con cache:   Cliente → API → Redis (0.1ms)     → API → Cliente
```

**Mejora**: ~200x más rápido para consultas repetidas.

---

## ⚙️ Configuración en el Proyecto

### 1. Variables de entorno (`.env`)

```env
# Redis connection
REDIS_HOST=localhost      # Dirección del servidor Redis
REDIS_PORT=6379          # Puerto por defecto de Redis
REDIS_PASSWORD=          # Contraseña (vacío = sin auth)
REDIS_DB=0               # Base de datos (0-15, por defecto 0)
REDIS_TTL=300            # Tiempo de vida del cache en segundos (5 min)
```

### 2. Docker Compose (`docker-compose.yml`)

```yaml
redis:
  image: redis:7-alpine
  container_name: nestjs_redis
  ports:
    - '6379:6379'  # Accesible en localhost:6379
  volumes:
    - redis_data:/data  # Persistencia en disco
  command: >
    redis-server
    --appendonly yes      # Guarda datos en disco
    --appendfsync everysec # Sincroniza cada 1 segundo
```

### 3. Módulo NestJS (`users.module.ts`)

```typescript
CacheModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    store: 'ioredis',                    // Driver de Redis
    host: config.get<string>('REDIS_HOST'),
    port: config.get<number>('REDIS_PORT'),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    db: config.get<number>('REDIS_DB', 0),
    ttl: config.get<number>('REDIS_TTL', 300),
  }),
}),
```

---

## 💻 Cómo se usa en `user.service.ts`

### **Patrón Cache-Aside (Lazy Loading)**

```typescript
// 1. Intentar leer del cache
const cached = await this.cacheManager.get<UserResponseDto>(cacheKey);
if (cached) {
  return Result.ok(cached);  // ✅ Cache HIT → devolver rápido
}

// 2. Si no está en cache, leer de la BD
const user = await this.userRepository.findById(id);

// 3. Guardar en cache para la próxima vez
await this.cacheManager.set(cacheKey, userDto, 300000); // 5 min

return Result.ok(userDto);
```

### **Claves de Cache (Cache Keys)**

```typescript
const CACHE_KEYS = {
  USER_BY_ID: (id: string) => `users:${id}`,           // "users:123e4567"
  USERS_LIST: (query: string) => `users:list:${query}`, // "users:list:{"page":1}"
};
```

**Convención**: `namespace:id` → fácil de identificar y limpiar.

### **Invalidación de Cache**

Cuando actualizas o eliminas un usuario, borramos su clave de Redis:

```typescript
private async invalidateUserCache(id: string) {
  await this.cacheManager.del(CACHE_KEYS.USER_BY_ID(id));
}
```

**Importante**: No eliminamos la lista cacheada (`users:list:...`) porque regenerarse automáticamente en la próxima consulta (TTL corto: 60s).

---

## 🧪 Ejemplos Prácticos

### **Ejemplo 1: Consultar usuario (con cache)**

**Primera llamada** (Cache MISS → consulta BD):
```bash
curl http://localhost:3000/users/123
```
Logs:
```
Cache MISS: users:123 → consultando BD
Usuario creado exitosamente: 123
```

**Segunda llamada** (Cache HIT → Redis):
```bash
curl http://localhost:3000/users/123
```
Logs:
```
Cache HIT: users:123
```

---

### **Ejemplo 2: Actualizar usuario (invalida cache)**

```bash
curl -X PATCH http://localhost:3000/users/123 \
  -H "Content-Type: application/json" \
  -d '{"firstName": "NuevoNombre"}'
```

Internamente:
1. Actualiza en PostgreSQL
2. Borra `users:123` de Redis
3. Próxima consulta → Cache MISS → lee BD y guarda nuevo valor

---

### **Ejemplo 3: Listar usuarios (cache por query)**

```bash
# Consulta con filtros
curl "http://localhost:3000/users?page=1&limit=10&role=ADMIN"
```

Cache key generada:
```typescript
`users:list:{"page":1,"limit":10,"role":"ADMIN"}`
```

TTL: 60 segundos (más corto porque las listas cambian frecuentemente).

---

## 🔧 Comandos Útiles de Redis CLI

```bash
# Conectar a Redis
redis-cli

# Probar conexión
PING  # → PONG

# Ver todas las claves
KEYS *

# Ver valor de una clave
GET users:123

# Eliminar una clave
DEL users:123

# Ver TTL de una clave
TTL users:123  # -1 = sin expiración, -2 = ya expiró

# Limpiar toda la base de datos
FLUSHDB

# Ver estadísticas
INFO stats

# Salir
EXIT
```

---

## 📊 Flujo de Datos

```
┌─────────────┐
│   Cliente   │
│   (curl)    │
└──────┬──────┘
       │ GET /users/:id
       ▼
┌─────────────────┐
│  UsersController│
└────────┬────────┘
         │ llama a
         ▼
┌─────────────────┐
│   UserService   │
└────────┬────────┘
         │ ¿en cache?
         │
    ┌────┴────┐
    │         │
   SÍ        NO
    │         │
    ▼         ▼
┌──────┐  ┌──────────────┐
│Redis │  │  PostgreSQL  │
│ HIT  │  │   (TypeORM)  │
└──────┘  └──────┬───────┘
   │            │
   └─────┬──────┘
         │ respuesta
         ▼
    ┌─────────────┐
    │  Cliente    │
    └─────────────┘
```

---

## ⚠️ Consideraciones Importantes

### **1. Cache Invalidation**

- **Problema**: Si actualizas un usuario en BD pero NO eliminas la clave de Redis → desincronización
- **Solución**: Siempre eliminar la clave cacheada en `update` y `delete`

### **2. Cache Stampede**

- **Problema**: Muchas requests simultáneas cache MISS → todas golpean la BD
- **Solución**: Patrón "lock" o usar `cache-manager` con `wrap()`:
```typescript
const user = await this.cacheManager.wrap(cacheKey, async () => {
  return await this.userRepository.findById(id);
}, { ttl: 300000 });
```

### **3. TTL (Time To Live)**

- **Usuario individual**: 300s (5 min) → poca actualización
- **Lista de usuarios**: 60s (1 min) → datos más volátiles

### **4. Fallos de Redis**

El código maneja graceful degradation:

```typescript
try {
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;
} catch {
  // Si Redis falla, continuamos sin cache
}
```

La aplicación sigue funcionando aunque Redis esté caído (solo más lento).

---

## 🚀 Levantar el Proyecto Completo

```bash
# 1. Levantar Redis + PostgreSQL
docker-compose up -d

# 2. Verificar que Redis está activo
redis-cli ping  # Debe responder PONG

# 3. Instalar dependencias
npm install

# 4. Iniciar la API
npm run start:dev

# 5. Probar cache
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Juan","lastName":"Perez","email":"juan@test.com","password":"Pass123!"}'

# Copia el ID devuelto y:
curl http://localhost:3000/users/<ID>  # Primera: Cache MISS
curl http://localhost:3000/users/<ID>  # Segunda: Cache HIT
```

---

## 📚 Recursos Adicionales

- **Redis Documentation**: https://redis.io/docs/
- **NestJS Cache**: https://docs.nestjs.com/techniques/cache
- **Cache-Manager**: https://www.npmjs.com/package/cache-manager
- **Patrones de cache**: https://redis.io/topics/lru-cache

---

## 🎯 Resumen

| Concepto | Valor en el proyecto |
|----------|---------------------|
| **Driver** | `cache-manager-ioredis-yet` |
| **Host** | `localhost` (Docker: `redis`) |
| **Puerto** | `6379` |
| **TTL usuario** | 300 segundos (5 min) |
| **TTL lista** | 60 segundos (1 min) |
| **DB Redis** | `0` |
| **Patrón** | Cache-Aside (Lazy Loading) |
| **Invalidación** | Manual en `update/delete` |

✅ **Redis está funcionando como cache de consultas frecuentes**, reduciendo la carga en PostgreSQL y mejorando drásticamente los tiempos de respuesta para datos que no cambian frecuentemente.
