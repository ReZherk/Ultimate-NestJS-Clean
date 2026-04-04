import { AsyncResult } from 'src/common/result/result';
import type { PaginatedResult } from 'src/common/result/result';
import { UserEntity } from '../entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Token de inyección de dependencias
// NestJS necesita un token para saber qué inyectar cuando alguien pide
// IUserRepository. Usamos una constante de string (o Symbol).
// ─────────────────────────────────────────────────────────────────────────────
export const USER_REPOSITORY = 'USER_REPOSITORY';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de filtros para búsquedas avanzadas
// ─────────────────────────────────────────────────────────────────────────────
export interface UserFilters {
  isActive?: boolean; // Filtrar por estado activo/inactivo
  role?: string; // Filtrar por rol
  search?: string; // Búsqueda en nombre y email
}

export interface PaginationOptions {
  page: number; // Página actual (empieza en 1)
  limit: number; // Registros por página
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface: contrato que CUALQUIER implementación del repositorio debe cumplir
// ─────────────────────────────────────────────────────────────────────────────
export interface IUserRepository {
  /**
   * Crea un nuevo usuario en la persistencia
   * @returns Result con el usuario creado
   */
  create(user: UserEntity): AsyncResult<UserEntity>;

  /**
   * Busca un usuario por su ID único
   * @returns Result.ok(user) si existe, Result.notFound() si no
   */
  findById(id: string): AsyncResult<UserEntity>;

  /**
   * Busca un usuario por su email
   * Útil para login y verificar duplicados
   */
  findByEmail(email: string): AsyncResult<UserEntity | null>;

  /**
   * Devuelve todos los usuarios con paginación y filtros
   * NUNCA devuelvas todos los usuarios sin paginar en producción
   */
  findAll(
    pagination: PaginationOptions,
    filters?: UserFilters,
  ): AsyncResult<PaginatedResult<UserEntity>>;

  /**
   * Actualiza un usuario existente (merge parcial)
   * Solo actualiza los campos que recibe
   */
  update(id: string, partial: Partial<UserEntity>): AsyncResult<UserEntity>;

  /**
   * Soft-delete: marca el usuario como eliminado (no borra de BD)
   * TypeORM con DeleteDateColumn hace esto automáticamente
   */
  softDelete(id: string): AsyncResult<void>;

  /**
   * Hard-delete: elimina físicamente el registro
   * USAR CON PRECAUCIÓN. Normalmente preferimos soft-delete.
   */
  hardDelete(id: string): AsyncResult<void>;

  /**
   * Verifica si un email ya está en uso
   * Útil para validación antes de crear/actualizar
   */
  existsByEmail(email: string): AsyncResult<boolean>;

  /**
   * Cuenta total de usuarios (con filtros opcionales)
   * Útil para dashboards y estadísticas
   */
  count(filters?: UserFilters): AsyncResult<number>;
}
