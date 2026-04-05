# Estrategias de Cache con Redis - Guía Técnica

## 📚 **Índice**
1. [Contexto del Proyecto](#contexto-del-proyecto)
2. [Estrategias Disponibles](#estrategias-disponibles)
3. [Comparativa Detallada](#comparativa-detallada)
4. [Implementación Actual](#implementación-actual)
5. [Recomendación por Nivel de Escala](#recomendación-por-nivel-de-escala)

---

## 🎯 **Contexto del Proyecto**

### **Problema identificado**
Al actualizar un usuario, el cache de la lista (`users:list:*`) no se invalidaba, por lo que los `GET /users` devolvían datos desactualizados hasta que expiraba el TTL (60 segundos).

### **Solución actual implementada**
- Reducir TTL de lista de 60s a 30s
- Mantener TTL de 5 min para individuales
- **Trade-off:** Consistencia eventual (máx 30s), pero sin complejidad adicional

---

## 🔄 **Estrategias de Cache Disponibles**

### **1. Cache Aside (Lazy Loading)**
**Como funciona:**
```typescript
// Lectura
const data = await cache.get(key);
if (!data) {
  data = await db.query();
  await cache.set(key, data, ttl);
}

// Escritura
await db.update();
await cache.del(key); // Invalidación explícita
```

**En nuestro proyecto:**
- ✅ Implementada en `UserService`
- ✅ TTL: 5 min (individual), 30s (lista)
- ❌ Invalidación de lista incompleta

**Ventajas:**
- Simple de entender
- Control total sobre cuándo se cachea
- No requiere librerías especiales

**Desventajas:**
- Cache misses en primera consulta
- Requiere invalidación manual
- Race conditions posibles (stampede)

---

### **2. Short TTL (Consistencia Eventual)**

**Concepto:**
No invalidar explícitamente. Solo confiar en que los datos expiran rápido.

```typescript
// Lectura
const data = await cache.get(key) || await db.query();
await cache.set(key, data, SHORT_TTL); // 10-30 segundos

// Escritura
await db.update();
// NO invalidar cache
```

**En nuestro proyecto:**
- ✅ Aplicado a `GET /users` (lista)
- TTL = 30 segundos
- ✅ **Máximo desfase:** 30 segundos

**Ventajas:**
- Código más simple (sin invalidación)
- Sin riesgo de olvidar invalidar algo
- Auto-recuperación

**Desventajas:**
- Ventana de datos stale (inaceptable para datos críticos)
- Más carga en BD (pero manejable con TTL bajo)

**✅ Mejor para:**
- Datos que cambian poco o aceptan retraso
- Lists donde la frescura no es crítica
- Sistemas con alta escalabilidad

---

### **3. Cache Tags (Invalidación por Categoría)**

**Concepto:**
Asociar múltiples claves con "tags" (etiquetas). Al invalidar un tag, se borran todas las claves asociadas.

```typescript
// Escritura
await cache.set(key, data, { ttl: 300, tags: ['users'] });

// Actualización
await db.update();
await cache.invalidateTags(['users']); // Borra TODO con tag 'users'
```

**Implementación requerida:**
```bash
npm install cache-manager-ioredis-store
# o
npm install @nestjs-modules/cache-manager-ioredis
```

**Configuración:**
```typescript
CacheModule.registerAsync({
  useFactory: () => ({
    store: 'ioredis',
    host: 'localhost',
    port: 6379,
    // Tags requieren Redis backend (no memoria)
  }),
}),
```

**Ventajas:**
- ✅ Invalidación automática y completa
- ✅ Muy limpio conceptualmente
- ✅ Soporta múltiples tags por clave
- ✅ Redis soporta nativamente esto

**Desventajas:**
- ⚠️ Requiere Redis (no memoria)
- ⚠️ `invalidateTags()` puede ser lento con miles de claves
- 📦 Dependencia externa adicional

**✅ Mejor para:**
- Sistemas complejos con muchas relaciones
- Cuando necesitas invalidar "todo lo relacionado" fácilmente
- Producción con Redis garantizado

---

### **4. Write-Through Cache (Cache de Escritura)**

**Concepto:**
Actualizar el cache inmediatamente después de escribir en BD.

```typescript
async updateUser(id: string, dto: UpdateUserDto) {
  const user = await db.update(id, dto);

  // Actualizar cache inmediatamente
  const freshData = await db.findById(id); // o reconstruir desde user
  await cache.set(`users:${id}`, freshData, TTL);
  await refreshListCache(); // Recalcular toda la lista

  return user;
}
```

**Ventajas:**
- ✅ Cache siempre fresco (consistencia fuerte)
- ✅ Sin periodos de desfase
- ✅ No dependes de TTL

**Desventajas:**
- ❌ Complejidad alta (hay que actualizar múltiples claves)
- ❌ `refreshListCache()` puede ser costoso (re-query completa)
- ❌ Posibles race conditions si hay múltiples writes
- ❌ Performance impact en writes

**✅ Mejor para:**
- Datos que **deben** estar siempre frescos
- Sistemas con writes poco frecuentes
- Cuando el costo de recalcular listas es bajo

---

### **5. Write-Behind Cache (Async Refresh)**

**Concepto:**
Escribir en BD y despachar un job asíncrono para actualizar cache.

```typescript
async updateUser(id: string, dto: UpdateUserDto) {
  await db.update(id, dto);

  // Disparar refresco asíncrono (no esperar)
  cacheRefreshQueue.add('refresh-user-list');
  cacheRefreshQueue.add('refresh-user', { id });

  return user;
}
```

**Ventajas:**
- ✅ Writes rápidos (no bloquean)
- ✅ Cache eventualmente frescos
- ✅ Escalable con colas

**Desventajas:**
- ❌ Complejidad alta (necesitas queue/worker)
- ❌ Ventana de desfase más larga
- ❌ Puedes perder updates si falla el worker

**✅ Mejor para:**
- Writes muy frecuentes
- Sistemas con infraestructura de colas
- Cuando la BD es el bottleneck

---

### **6. Pattern-Based Deletion (KEYS \*)**

**Concepto:**
Borrar todas las claves que coinciden con un patrón.

```typescript
await db.update();
const client = cache.store.client; // Acceso directo a Redis
const keys = await client.keys('users:list:*'); // 🚨 BLOCKING!
if (keys.length) await client.del(...keys);
```

**Ventajas:**
- ✅ Simple de entender
- ✅ Asegura limpieza total

**Desventajas:**
- 🚨 **NUNCA en producción:** `KEYS *` es O(N) y bloquea Redis
- 📉 Performance catastrófica con miles de claves
- ❌ No escala

**✅ Solo para:**
- Desarrollo / debugging
- Sistemas muy pequeños (< 100 claves)
- Scripts de mantenimiento (en ventana de baja carga)

---

### **7. Cache Versioning (Key Namespacing)**

**Concepto:**
Incluir un "version number" en la clave. Cambiar versión =Invalidación automática.

```typescript
let userListVersion = 1;

const cacheKey = `users:list:v${userListVersion}:${queryHash}`;

// Al actualizar
userListVersion++;
// Todas las claves antiguas quedan obsoletas (nunca se usan)
```

**Ventajas:**
- ✅ Invalidación instantánea sin borrar
- ✅ Muy rápido (solo cambia string)
- ✅ Sin race conditions
- ✅ Redis puede tener TTL largos sin worries

**Desventajas:**
- ❌ Memory leak potencial (claves viejas acumulan)
- ❌ Necesitas limpiar viejas versiones periódicamente
- ❌ Complejidad en gestión de versión

**✅ Mejor para:**
- Listas que cambian frecuentemente
- Cuando quieres TTL largo pero invalidación inmediata
- Sistemas con multiples versiones concurrentes (A/B testing)

---

## 📊 **Comparativa Detallada**

| Estrategia | Complejidad | Consistencia | Redis Req | Escalabilidad | Mejor para |
|------------|-------------|--------------|-----------|---------------|------------|
| **Cache Aside** | Baja | Fuerte (si invalidas bien) | No | ✅ Alta | General purpose |
| **Short TTL** | Muy baja | Eventual | No | ✅✅ Muy alta | Lists, datos no críticos |
| **Cache Tags** | Media | Fuerte | ✅ Sí | ✅ Alta | Sistemas complejos |
| **Write-Through** | Alta | Fuerte | No | ⚠️ Media | Datos críticos |
| **Write-Behind** | Muy alta | Eventual | No | ✅ Alta (con queue) | Alto write volume |
| **Pattern Deletion** | Baja | Fuerte | ✅ Sí | ❌ Baja | ❌ NO PROD |
| **Versioning** | Media | Fuerte | No | ✅ Alta | Lists con versiones |

---

## 🏗️ **Implementación Actual del Proyecto**

### **Archivo:** `src/modules/users/application/services/user.service.ts`

### **Cache Configuration**

```typescript
const CACHE_KEYS = {
  USER_BY_ID: (id: string) => `users:${id}`,
  USERS_LIST: (query: string) => `users:list:${query}`,
} as const;
```

### **Read Operations**

```typescript
// 1. findUserById - TTL: 5 min (300000ms)
const cached = await this.cacheManager.get<UserResponseDto>(cacheKey);
if (cached) return Result.ok(cached);
// ... query DB, then set with 300000ms

// 2. findAllUsers - TTL: 30s (30000ms)
const cached = await this.cacheManager.get<PaginatedResult<UserResponseDto>>(cacheKey);
if (cached) return Result.ok(cached);
// ... query DB, then set with 30000ms
```

### **Write Operations**

```typescript
async updateUser(id: string, dto: UpdateUserDto) {
  const updateResult = await this.userRepository.update(id, dto);
  if (updateResult.isSuccess) {
    await this.invalidateUserCache(id); // Solo invalidate individual
    // ❌ NO invalidate list - relies on TTL
  }
}

private async invalidateUserCache(id: string): Promise<void> {
  await this.cacheManager.del(CACHE_KEYS.USER_BY_ID(id));
  // List cache expires in 30s automatically
}
```

### **Diagrama de Flujo**

```
┌─────────────────┐
│   GET /users    │
│   (Lista)       │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Cache? │──HIT─→ Return cached (max 30s stale)
    └────┬────┘
         │ MISS
         │
    ┌────▼────┐
    │   DB    │
    └────┬────┘
         │
    ┌────▼────┐
    │  Cache  │ (TTL: 30s)
    └─────────┘


┌─────────────────┐
│ PATCH /users/:id│
│   (Update)      │
└────────┬────────┘
         │
    ┌────▼────┐
    │   DB    │
    └────┬────┘
         │
    ┌────▼─────────────────────┐
    │ Invalidate: users:{id}   │
    │ Delete from cache        │
    └──────────────────────────┘
    │
    └─ List cache stays (expires in ≤30s)
```

---

## 🎯 **Recomendación por Nivel de Escala**

### **🚀 Fase 1: Prototipo / MVP** (actual)
- **Estrategia:** Short TTL
- **TTL individual:** 5 min
- **TTL lista:** 30s
- **✅ Motivo:** Simple, efectivo, sin dependencias

### **📈 Fase 2: Producción Temprana** (100-1000 usuarios)
- **Estrategia:** Cache Tags + Short TTL
- **Agregar:** `cache-manager-ioredis-store`
- **Invalidar:** Tags en update/delete
- **TTL:** Individual 10 min, Lista 1 min
- **✅ Motivo:** Mejor consistencia, aún simple

### **🏗️ Fase 3: Escala Media** (1000-10000 usuarios)
- **Estrategia:** Cache Tags + Versioning
- **Tags:** Para invalidación de entidades
- **Versioning:** Para listas (cada update incrementa versión)
- **TTL:** Individual 30 min, Lista 5 min (pero version cambia)
- **✅ Motivo:** Máximo performance, consistencia fuerte

### **🦾 Fase 4: Gran Escala** (10000+ usuarios)
- **Estrategia:** Write-Behind + Event Sourcing
- **Arquitectura:**
  - Cache Aside para reads
  - Cola de eventos (Redis Streams, RabbitMQ)
  - Workers que actualizan cache asíncronamente
  - Cache versioning para lists
- **✅ Motivo:** Writes no bloquean, cache siempre fresco (casi), escala horizontal

---

## 🔧 **Code Snippets para Cambios Futuros**

### **A. Implementar Cache Tags**

```typescript
// 1. Instalar:
// npm install cache-manager-ioredis-store

// 2. Configurar users.module.ts
CacheModule.registerAsync({
  useFactory: () => ({
    store: 'ioredis',
    host: 'localhost',
    port: 6379,
    ttl: 300,
    // Tags Field-Separator: delimita tags en una clave
    // Ej: users:123:profile[::tag1,tag2]
    // fieldSeparator: ':', // default
  }),
}),

// 3. UserService.ts - set con tags
await this.cacheManager.set(cacheKey, data, {
  ttl: 300000,
  tags: ['users', 'user-detail'],
});

// 4. Invalidar tags
await this.cacheManager.invalidateTags(['users']);
```

### **B. Implementar Versioning**

```typescript
// 1. Variable global de versión
private static listVersion = 1;

// 2. Cache key con versión
const cacheKey = `users:list:v${UserService.listVersion}:${JSON.stringify(query)}`;

// 3. Al actualizar
UserService.listVersion++;
// Opcional: cleanup de claves viejas (background job)
```

### **C. Write-Behind con Queue**

```typescript
// 1. ConfigurarBull o Redis Queue
@InjectQueue('cache-refresh')
private readonly queue: Queue;

// 2. En updateUser
await queue.add('refresh-user-list', { userId: id });
await queue.add('refresh-user-cache', { userId: id });

// 3. Worker que procesa
@Process('refresh-user-list')
async refreshUserList(job: Job) {
  await this.recalculateUsersListCache();
}
```

---

## ⚠️ **Anti-Patterns a Evitar**

### **❌ 1. Cache Everything**
```typescript
// MAL: Cache absoluto, sin TTL
await cache.set(key, data); // Nunca expira → memory leak

// BIEN: Siemco TTL
await cache.set(key, data, { ttl: 300 });
```

### **❌ 2. Cache sin invalidación**
```typescript
// MAL: Update pero no borras cache
await db.update(user);
// cache.usersList sigue con datos viejos

// BIEN: Invalida o usa short TTL
await db.update(user);
await cache.del(cacheKey);
// o: TTL corto (30s)
```

### **❌ 3. Cache de datos volátiles**
```typescript
// MAL: Cache de stock en tiempo real (TTL 1s)
// Puede causar overbooking

// BIEN: Para stock, no cache o cache ultra-corto + lock
```

### **❌ 4. KEYS \* en producción**
```typescript
// MAL: Bloqueas Redis
const keys = await client.keys('users:*'); // O(N) blocking
await client.del(...keys);

// BIEN: Usa tags o versioning
await cache.invalidateTags(['users']);
// o: versioning (sin borrado)
```

### **❌ 5. Cache sin fallback**
```typescript
// MAL: Si cache falla, no hay datos
const data = await cache.get(key);
return data; // undefined si falla cache

// BIEN: Always try DB as fallback
const cached = await cache.get(key);
if (cached) return cached;
const dbData = await db.query();
await cache.set(key, dbData, ttl);
return dbData;
```

---

## 🧪 **Testing de Estrategias de Cache**

### **Test de invalidación**
```typescript
it('should invalidate cache on update', async () => {
  // Arrange
  const user = await createTestUser();
  await service.findUserById(user.id); // Cachea

  // Act
  await service.updateUser(user.id, { firstName: 'NewName' });

  // Assert - Cache debe estar invalidado
  const cacheKey = `users:${user.id}`;
  const cached = await cache.get(cacheKey);
  expect(cached).toBeUndefined(); // Cache borrado
});
```

### **Test de TTL**
```typescript
it('should expire list cache after 30s', async () => {
  await service.findAllUsers({ page: 1, limit: 10 });

  // Simular que pasó 31s (mock time o await real)
  await new Promise(resolve => setTimeout(resolve, 31000));

  const cacheKey = expect.stringContaining('users:list:');
  const cached = await cache.get(cacheKey);
  expect(cached).toBeUndefined(); // Expirado
});
```

---

## 📈 **Monitoreo y Métricas**

### **Métricas clave a trackear**
1. **Cache Hit Rate** = hits / (hits + misses)
   - Target: >70% para lists, >90% para individuals
2. **Average Cache Latency** = p50/p95/p99
   - Target: <5ms (Redis local)
3. **Memory Usage** = Redis used_memory
   - Target: <70% de RAM asignada
4. **Invalidation Rate** = invalidations / writes
   - Track para ajustar TTLs

### **Comandos Redis CLI útiles**
```bash
# Ver stats
redis-cli info stats

# Ver keys por patrón
redis-cli keys 'users:*'

# Ver TTL de una clave
redis-cli ttl 'users:123e4567-...'

# Monitor de comandos en tiempo real
redis-cli monitor

# Ver memoria usada
redis-cli info memory
```

---

## 🗺️ **Roadmap Futuro**

| Fase | Escala | Estrategia | TTI (Time To Invalidate) | Complejidad |
|------|--------|------------|--------------------------|-------------|
| 1 | <1000 usuarios | Short TTL + Invalidation Individual | ≤30s | Baja |
| 2 | <5000 usuarios | Cache Tags + Short TTL | <1s (tags) | Media |
| 3 | <20000 usuarios | Versioning + Tags | Instantáneo | Media-Alta |
| 4 | >20000 usuarios | Write-Behind + Events | <1s (async) | Alta |

---

## 📝 **Checklist de Implementación**

Para cada entidad/recurso:

- [ ] Definir TTLs diferenciados (individual vs lista)
- [ ] Implementar cache aside pattern
- [ ] Invalidar cache individual en write operations
- [ ] Decidir: ¿Short TTL o Tags para listas?
- [ ] Agregar logging de hits/misses
- [ ] Escribir tests de cache
- [ ] Documentar comportamiento en API docs
- [ ] Setup monitoreo (Redis CLI o APM)
- [ ] Plan de migración si cambia estrategia

---

## 🔗 **Recursos**

- [Cache-Aside Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis Caching Strategies](https://redis.io/docs/manual/patterns/)
- [NestJS Cache Module](https://docs.nestjs.com/techniques/caching)
- [Cache Stampede Problem](https://blog.kiprosh.com/ways-to-avoid-cache-stampede/)

---

## 💬 **Glosario**

- **TTL** - Time To Live (tiempo de vida de la clave en Redis)
- **Cache Hit** - Se encontró dato en cache
- **Cache Miss** - No estaba en cache, se consultó BD
- **Invalidation** - Borrar/actualizar cache para forzar fresh read
- **Consistencia Fuerte** - Cache siempre tiene datos actuales
- **Consistencia Eventual** - Cache puede estar stale por corto periodo
- **Cache Stampede** - Múltiples peticiones saturan BD al mismo tiempo cuando expira cache
- **Tags** - Etiquetas para agrupar multiples claves
