# API Endpoints - Módulo Users

## 📋 **Resumen**
Módulo de gestión de usuarios con cache Redis, paginación, filtros y soft delete.

**Base URL:** `/api/users`

---

## 🔧 **Endpoints Disponibles**

### 1. **Crear Usuario**
`POST /users`

Crea un nuevo usuario en el sistema.

#### **Request Body**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan.perez@ejemplo.com",
  "password": "MiClave123!",
  "role": "user"
}
```

#### **Campos obligatorios**
- `firstName` (string, 2-100 chars)
- `lastName` (string, 2-100 chars)
- `email` (string, válido, único)
- `password` (string, 8-255 chars, debe incluir: mayúscula, minúscula, número, especial)

#### **Campos opcionales**
- `role` (enum: `admin` | `user` | `moderator`, default: `user`)

#### **Respuesta exitosa (201)**
```json
{
  "isSuccess": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan.perez@ejemplo.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### **Errores comunes**
- `409 Conflict` - Email ya existe
- `400 Bad Request` - Validación fallida (formato email, password, longitud)

---

### 2. **Obtener Usuario por ID**
`GET /users/:id`

Recupera un usuario específico por su UUID. Usa cache Redis (5 min TTL).

#### **Parámetros de ruta**
- `id` (string) - UUID del usuario

#### **Ejemplo**
```
GET /users/123e4567-e89b-12d3-a456-426614174000
```

#### **Respuesta exitosa (200)**
```json
{
  "isSuccess": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan.perez@ejemplo.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### **Errores comunes**
- `404 Not Found` - Usuario no existe o fue eliminado

---

### 3. **Listar Usuarios (con paginación y filtros)**
`GET /users`

Obtiene lista paginada de usuarios con filtros opcionales. Usa cache Redis (30s TTL).

#### **Query Parameters**

| Parámetro | Tipo | Opcional | Descripción | Ejemplo |
|-----------|------|----------|-------------|---------|
| `page` | number | ✅ | Número de página (mín: 1) | `?page=2` |
| `limit` | number | ✅ | Registros por página (máx: 100) | `?limit=25` |
| `search` | string | ✅ | Búsqueda en nombre y email | `?search=juan` |
| `role` | enum | ✅ | Filtrar por rol | `?role=admin` |
| `isActive` | boolean | ✅ | Filtrar por estado | `?isActive=true` |

#### **Ejemplos**

**Básico:**
```
GET /users
```

**Con filtros:**
```
GET /users?page=2&limit=20&role=admin&isActive=true
```

**Búsqueda:**
```
GET /users?search=maria
```

#### **Respuesta exitosa (200)**
```json
{
  "isSuccess": true,
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "firstName": "Juan",
        "lastName": "Pérez",
        "email": "juan.perez@ejemplo.com",
        "role": "user",
        "isActive": true,
        "createdAt": "2025-01-15T10:30:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "223e4567-e89b-12d3-a456-426614174001",
        "firstName": "María",
        "lastName": "Gómez",
        "email": "maria.gomez@ejemplo.com",
        "role": "admin",
        "isActive": true,
        "createdAt": "2025-01-14T09:15:00.000Z",
        "updatedAt": "2025-01-14T09:15:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 4. **Actualizar Usuario**
`PATCH /users/:id`

Actualiza campos específicos de un usuario. Invalida cache automáticamente.

#### **Parámetros de ruta**
- `id` (string) - UUID del usuario

#### **Request Body**
Campos a actualizar (todos opcionales):

```json
{
  "firstName": "Juan Carlos",
  "lastName": "Pérez López",
  "email": "juan.carlos@ejemplo.com",
  "role": "admin",
  "isActive": false
}
```

**Nota:** No se puede actualizar la contraseña por este endpoint (requeriría un endpoint separado).

#### **Ejemplo**
```
PATCH /users/123e4567-e89b-12d3-a456-426614174000
```

#### **Respuesta exitosa (200)**
```json
{
  "isSuccess": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "Juan Carlos",
    "lastName": "Pérez López",
    "email": "juan.carlos@ejemplo.com",
    "role": "admin",
    "isActive": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-16T14:20:00.000Z"
  }
}
```

#### **Errores comunes**
- `404 Not Found` - Usuario no existe
- `409 Conflict` - Email ya existe (si se cambia a uno ya registrado)
- `400 Bad Request` - Validación fallida

---

### 5. **Eliminar Usuario (Soft Delete)**
`DELETE /users/:id`

Marca un usuario como eliminado (soft delete). El registro permanece en BD pero no aparece en queries.

#### **Parámetros de ruta**
- `id` (string) - UUID del usuario

#### **Ejemplo**
```
DELETE /users/123e4567-e89b-12d3-a456-426614174000
```

#### **Respuesta exitosa (200)**
```json
{
  "isSuccess": true,
  "data": null
}
```

#### **Errores comunes**
- `404 Not Found` - Usuario no existe

**Nota:** Para recuperar un usuario eliminado, necesitarías un endpoint de "restore" (no implementado).

---

## 🔄 **Flujo de Cache**

### **GET /users/:id**
- ✅ **Cache HIT** → Retorna datos cacheados (TTL: 5 min)
- ❌ **Cache MISS** → Consulta BD, guarda en cache
- 🔄 **Invalidación** → Se borra al actualizar/eliminar el usuario

### **GET /users**
- ✅ **Cache HIT** → Retorna lista cacheada (TTL: 30 segundos)
- ❌ **Cache MISS** → Consulta BD con filtros, guarda en cache
- ⚠️ **Invalidación** → No se invalida explícitamente (consistencia eventual por TTL corto)

---

## 🏗️ **Estructura de Respuestas**

Todos los endpoints retornan:

```typescript
{
  "isSuccess": boolean,
  "data": T | null,
  "error?"?: {
    "code": string,
    "message": string,
    "details?"?: any
  }
}
```

---

## 📊 **Tabla Rápida**

| Método | Endpoint | Cache | Descripción |
|--------|----------|-------|-------------|
| POST | `/users` | ❌ | Crear usuario |
| GET | `/users/:id` | ✅ (5 min) | Obtener por ID |
| GET | `/users` | ✅ (30s) | Listar con filtros |
| PATCH | `/users/:id` | 🔄 Borra cache | Actualizar usuario |
| DELETE | `/users/:id` | 🔄 Borra cache | Eliminar (soft delete) |

---

## 💡 **Ejemplos de Uso Común**

### **1. Crear y luego consultar**
```bash
# Crear
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ana","lastName":"García","email":"ana@email.com","password":"Pass123!"}'

# Obtener
curl http://localhost:3000/api/users/{id-devuelto}
```

### **2. Filtrar usuarios activos admin**
```bash
curl "http://localhost:3000/api/users?role=admin&isActive=true&page=1&limit=20"
```

### **3. Actualizar nombre**
```bash
curl -X PATCH http://localhost:3000/api/users/{id} \
  -H "Content-Type: application/json" \
  -d '{"firstName":"NuevoNombre"}'
```

### **4. Búsqueda por email/nombre**
```bash
curl "http://localhost:3000/api/users?search=maria"
```

---

## ⚠️ **Consideraciones**

1. **Cache de lista:** TTL corto (30s) significa que una actualización puede tardar hasta 30s en reflejarse en listados
2. **Soft delete:** Los usuarios "eliminados" no aparecen en `GET /users`, pero `GET /users/:id` tampoco los encuentra
3. **Email único:** No se puede crear dos usuarios con el mismo email, ni actualizar a un email ya existente
4. **Paginación:** El `total` y `totalPages` se calculan automáticamente
5. **Autenticación:** Este documento asume que los endpoints están protegidos por Auth (no incluido en este módulo)

---

## 🔒 **Seguridad**

- **Password:** Nunca se devuelve en respuestas (`select: false` en entidad)
- **Email:** Se normaliza automáticamente a minúsculas
- **UUIDs:** Todos los IDs son UUID v4 generados en backend
- **Validación:** Class-validator valida todos los inputs
