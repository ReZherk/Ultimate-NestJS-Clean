import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; // Inyecta el Repository de TypeORM
import { Repository, IsNull, FindOptionsWhere } from 'typeorm'; // Utilidades de TypeORM

import { UserEntity, UserRole } from '../domain/entities/user.entity';
import {
  IUserRepository,
  PaginationOptions,
  UserFilters,
} from '../domain/repositories/user.repository.interface';
import type { PaginatedResult } from 'src/common/result/result';
import { AppErrorCode, AsyncResult, Result } from 'src/common/result/result';

@Injectable()
export class UserTypeOrmRepository implements IUserRepository {
  // Logger para auditoría y debugging de queries
  private readonly logger = new Logger(UserTypeOrmRepository.name);

  constructor(
    // @InjectRepository(UserEntity): NestJS inyecta el TypeORM Repository<UserEntity>
    // TypeORM Repository ya tiene: find, findOne, save, delete, count, etc.
    @InjectRepository(UserEntity)
    private readonly ormRepo: Repository<UserEntity>,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────
  async create(user: UserEntity): AsyncResult<UserEntity> {
    try {
      // ormRepo.save(): si tiene ID → UPDATE, si no → INSERT
      // Como el @BeforeInsert hook genera el ID, siempre hace INSERT aquí
      const saved = await this.ormRepo.save(user);

      this.logger.log(`Usuario creado: ${saved.id} (${saved.email})`);
      return Result.ok(saved);
    } catch (error: unknown) {
      // Detecta violación de constraint UNIQUE (email duplicado)
      // El código '23505' es el código PostgreSQL para unique_violation
      if (this.isUniqueViolation(error)) {
        return Result.fail({
          code: AppErrorCode.ALREADY_EXISTS,
          message: `Ya existe un usuario con ese email`,
          details: error,
        });
      }

      this.logger.error('Error al crear usuario', error);
      return Result.internalError(
        'Error al crear usuario en la base de datos',
        error,
      );
    }
  }

  // ─── FIND BY ID ────────────────────────────────────────────────────────────
  async findById(id: string): AsyncResult<UserEntity> {
    try {
      const user = await this.ormRepo.findOne({
        where: {
          id,
          deletedAt: IsNull(), // Solo usuarios no eliminados (soft-delete)
        },
      });

      if (!user) {
        return Result.notFound('Usuario', id);
      }

      return Result.ok(user);
    } catch (error: unknown) {
      this.logger.error(`Error al buscar usuario por id: ${id}`, error);
      return Result.internalError(`Error al buscar usuario`, error);
    }
  }

  // ─── FIND BY EMAIL ─────────────────────────────────────────────────────────
  async findByEmail(email: string): AsyncResult<UserEntity | null> {
    try {
      // addSelect('user.password'): incluye el campo password que está con select:false
      // Solo lo incluimos cuando necesitamos verificar la contraseña (login)
      const user = await this.ormRepo
        .createQueryBuilder('user')
        .addSelect('user.password') // Incluye la contraseña hasheada
        .where('user.email = :email', { email: email.toLowerCase().trim() })
        .andWhere('user.deletedAt IS NULL')
        .getOne();

      // null es válido aquí: significa que no existe usuario con ese email
      return Result.ok(user ?? null);
    } catch (error: unknown) {
      this.logger.error(`Error al buscar usuario por email: ${email}`, error);
      return Result.internalError('Error al buscar usuario', error);
    }
  }

  // ─── FIND ALL (con paginación y filtros) ────────────────────────────────────
  async findAll(
    pagination: PaginationOptions,
    filters?: UserFilters,
  ): AsyncResult<PaginatedResult<UserEntity>> {
    try {
      // QueryBuilder para queries complejas con múltiples condiciones
      const qb = this.ormRepo
        .createQueryBuilder('user')
        .where('user.deletedAt IS NULL'); // Excluye soft-deleted

      // ── Aplicar filtros dinámicos ────────────────────────────────────
      if (filters?.isActive !== undefined) {
        qb.andWhere('user.isActive = :isActive', {
          isActive: filters.isActive,
        });
      }

      if (filters?.role) {
        qb.andWhere('user.role = :role', { role: filters.role });
      }

      if (filters?.search) {
        // ILike: case-insensitive LIKE en PostgreSQL
        // Busca en nombre O email (% = wildcard)
        qb.andWhere(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      // ── Paginación ────────────────────────────────────────────────────
      const page = Math.max(1, pagination.page); // Mínimo página 1
      const limit = Math.min(100, pagination.limit); // Máximo 100 por página
      const offset = (page - 1) * limit; // Registros a saltar

      // getManyAndCount(): ejecuta dos queries: SELECT + COUNT(*)
      // Más eficiente que dos queries separadas
      const [data, total] = await qb
        .orderBy('user.createdAt', 'DESC') // Más recientes primero
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        data,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      });
    } catch (error: unknown) {
      this.logger.error('Error al listar usuarios', error);
      return Result.internalError('Error al listar usuarios', error);
    }
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────
  async update(
    id: string,
    partial: Partial<UserEntity>,
  ): AsyncResult<UserEntity> {
    try {
      // Primero verificamos que el usuario existe
      const findResult = await this.findById(id);
      if (findResult.isFailure) return findResult;

      const user = findResult.value;

      // Object.assign: aplica el partial sobre el usuario existente
      // Esto hace un merge: solo cambia los campos que vienen en partial
      Object.assign(user, partial);

      // save() con entidad existente hace UPDATE
      const updated = await this.ormRepo.save(user);

      this.logger.log(`Usuario actualizado: ${id}`);
      return Result.ok(updated);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        return Result.alreadyExists('usuario', 'email', partial.email ?? '');
      }
      this.logger.error(`Error al actualizar usuario: ${id}`, error);
      return Result.internalError('Error al actualizar usuario', error);
    }
  }

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────
  async softDelete(id: string): AsyncResult<void> {
    try {
      // Verifica que existe antes de eliminar
      const findResult = await this.findById(id);
      if (findResult.isFailure)
        return findResult as unknown as AsyncResult<void>;

      // softDelete(): establece deletedAt = NOW()
      // TypeORM gestiona esto automáticamente con @DeleteDateColumn
      await this.ormRepo.softDelete(id);

      this.logger.log(`Usuario soft-deleted: ${id}`);
      return Result.ok(undefined);
    } catch (error: unknown) {
      this.logger.error(`Error al eliminar usuario: ${id}`, error);
      return Result.internalError('Error al eliminar usuario', error);
    }
  }

  // ─── HARD DELETE ────────────────────────────────────────────────────────────
  async hardDelete(id: string): AsyncResult<void> {
    try {
      const result = await this.ormRepo.delete(id);

      // affected: número de filas afectadas (0 = no existía)
      if (result.affected === 0) {
        return Result.notFound('Usuario', id);
      }

      this.logger.log(`Usuario hard-deleted: ${id}`);
      return Result.ok(undefined);
    } catch (error: unknown) {
      this.logger.error(
        `Error al eliminar permanentemente usuario: ${id}`,
        error,
      );
      return Result.internalError('Error al eliminar usuario', error);
    }
  }

  // ─── EXISTS BY EMAIL ─────────────────────────────────────────────────────────
  async existsByEmail(email: string): AsyncResult<boolean> {
    try {
      // count() es más eficiente que findOne() para verificar existencia
      const count = await this.ormRepo.count({
        where: {
          email: email.toLowerCase(),
          deletedAt: IsNull(),
        },
      });

      return Result.ok(count > 0);
    } catch (error: unknown) {
      return Result.internalError('Error al verificar email', error);
    }
  }

  // ─── COUNT ────────────────────────────────────────────────────────────────
  async count(filters?: UserFilters): AsyncResult<number> {
    try {
      // FindOptionsWhere<UserEntity>: es el tipo exacto que TypeORM espera en where
      // Esto elimina el cast forzado al final
      const whereClause: FindOptionsWhere<UserEntity> = {
        deletedAt: IsNull(),
      };

      if (filters?.isActive !== undefined) {
        whereClause.isActive = filters.isActive;
      }

      if (filters?.role) {
        whereClause.role = filters.role as UserRole;
      }

      const total = await this.ormRepo.count({
        where: whereClause, //  TypeORM ya conoce el tipo, sin cast
      });

      return Result.ok(total);
    } catch (error: unknown) {
      return Result.internalError('Error al contar usuarios', error);
    }
  }

  // ─── HELPERS PRIVADOS ────────────────────────────────────────────────────────

  /** Detecta si un error es una violación de UNIQUE constraint en PostgreSQL */
  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
