import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'; // Importa ambos

import { UserEntity } from '../../domain/entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  GetUsersQueryDto,
  UserResponseDto,
} from '../../dto/user.dto';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'; // ← import type
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { PaginatedResult } from 'src/common/result/result';
import { AsyncResult, Result } from 'src/common/result/result';

// ─────────────────────────────────────────────────────────────────────────────
// Prefijos de cache keys (convención para namespacing en Redis)
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_KEYS = {
  USER_BY_ID: (id: string) => `users:${id}`,
  USERS_LIST: (query: string) => `users:list:${query}`,
} as const;

// Helper para transformar entidad a DTO (evita error unbound-method)
const toUserResponseDto = (entity: UserEntity): UserResponseDto => {
  const dto = new UserResponseDto();
  dto.id = entity.id;
  dto.firstName = entity.firstName;
  dto.lastName = entity.lastName;
  dto.email = entity.email;
  dto.role = entity.role;
  dto.isActive = entity.isActive;
  dto.createdAt = entity.createdAt;
  dto.updatedAt = entity.updatedAt;
  return dto;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    // Inject con el TOKEN (no la clase concreta)
    // NestJS buscará qué clase está registrada con el token USER_REPOSITORY
    // y la inyectará aquí. El Service NO sabe que es UserTypeOrmRepository.
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    // Inyecta el cache manager (Redis via @nestjs/cache-manager)
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // ─── CASO DE USO: Crear usuario ──────────────────────────────────────────────
  async createUser(dto: CreateUserDto): AsyncResult<UserResponseDto> {
    this.logger.log(`Creando usuario: ${dto.email}`);

    // ── Validación de negocio: email único ──────────────────────────────────
    const existsResult = await this.userRepository.existsByEmail(dto.email);
    if (existsResult.isFailure)
      return existsResult as unknown as AsyncResult<UserResponseDto>;

    if (existsResult.value) {
      // Email ya en uso → devuelve error semántico (no excepción)
      return Result.alreadyExists('usuario', 'email', dto.email);
    }

    // ── Crea la entidad con los datos del DTO ────────────────────────────────
    // Importante: NO usamos Object.assign directamente en producción
    // para mantener control de qué campos se pueden asignar
    const userEntity = new UserEntity();
    userEntity.firstName = dto.firstName;
    userEntity.lastName = dto.lastName;
    userEntity.email = dto.email;
    userEntity.password = dto.password; // El @BeforeInsert hará el hash
    userEntity.role = dto.role ?? userEntity.role; // Default está en la entidad

    // ── Persiste en la BD via repositorio ────────────────────────────────────
    const createResult = await this.userRepository.create(userEntity);
    if (createResult.isFailure)
      return createResult as unknown as AsyncResult<UserResponseDto>;

    // ── Transforma a DTO de respuesta (nunca devolver la entidad raw) ────────
    const responseDto = toUserResponseDto(createResult.value);

    this.logger.log(`Usuario creado exitosamente: ${responseDto.id}`);
    return Result.ok(responseDto);
  }

  // ─── CASO DE USO: Obtener usuario por ID ─────────────────────────────────────
  async findUserById(id: string): AsyncResult<UserResponseDto> {
    // ── Intenta obtener del cache primero ─────────────────────────────────────
    const cacheKey = CACHE_KEYS.USER_BY_ID(id);
    try {
      const cached = await this.cacheManager.get<UserResponseDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return Result.ok(cached);
      }
    } catch {
      // Si el cache falla, continuamos sin él (graceful degradation)
      // No necesitamos el error, solo lo logueamos si es necesario
    }

    // ── Busca en la BD ───────────────────────────────────────────────────────
    this.logger.debug(`Cache MISS: ${cacheKey} → consultando BD`);
    const findResult = await this.userRepository.findById(id);
    if (findResult.isFailure)
      return findResult as unknown as AsyncResult<UserResponseDto>;

    const responseDto = toUserResponseDto(findResult.value);

    // ── Guarda en cache para próximas requests ────────────────────────────────
    try {
      // TTL: 300 segundos (5 minutos). El cache se invalida al actualizar/eliminar.
      await this.cacheManager.set(cacheKey, responseDto, 300000); // ms
    } catch {
      this.logger.warn('Error guardando en cache');
    }

    return Result.ok(responseDto);
  }

  // ─── CASO DE USO: Listar usuarios con paginación ──────────────────────────────
  async findAllUsers(
    query: GetUsersQueryDto,
  ): AsyncResult<PaginatedResult<UserResponseDto>> {
    // ── Cache key basada en los parámetros de query ──────────────────────────
    const cacheKey = CACHE_KEYS.USERS_LIST(JSON.stringify(query));

    try {
      const cached =
        await this.cacheManager.get<PaginatedResult<UserResponseDto>>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT lista usuarios: ${cacheKey}`);
        return Result.ok(cached);
      }
    } catch {
      /* silencioso */
    }

    // ── Consulta con filtros y paginación ─────────────────────────────────────
    const result = await this.userRepository.findAll(
      { page: query.page ?? 1, limit: query.limit ?? 10 },
      {
        isActive: query.isActive,
        role: query.role,
        search: query.search,
      },
    );

    if (result.isFailure)
      return result as unknown as AsyncResult<PaginatedResult<UserResponseDto>>;

    // ── Transforma entidades a DTOs de respuesta ──────────────────────────────
    const paginatedResponse: PaginatedResult<UserResponseDto> = {
      ...result.value,
      data: result.value.data.map(toUserResponseDto),
    };

    try {
      // Cache de lista por 60 segundos (más corto que por ID, ya que cambia más)
      await this.cacheManager.set(cacheKey, paginatedResponse, 60000);
    } catch {
      /* silencioso */
    }

    return Result.ok(paginatedResponse);
  }

  // ─── CASO DE USO: Actualizar usuario ─────────────────────────────────────────
  async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): AsyncResult<UserResponseDto> {
    this.logger.log(`Actualizando usuario: ${id}`);

    // ── Validación: email único (si se está cambiando) ───────────────────────
    if (dto.email) {
      const existsResult = await this.userRepository.existsByEmail(dto.email);
      if (existsResult.isFailure)
        return existsResult as unknown as AsyncResult<UserResponseDto>;

      // Verifica que el email no pertenece a OTRO usuario
      // TODO: mejorar esta lógica para excluir el propio usuario
      if (existsResult.value) {
        return Result.alreadyExists('usuario', 'email', dto.email);
      }
    }

    // ── Actualiza en la BD ────────────────────────────────────────────────────
    const updateResult = await this.userRepository.update(
      id,
      dto as Partial<UserEntity>,
    );
    if (updateResult.isFailure)
      return updateResult as unknown as AsyncResult<UserResponseDto>;

    // ── Invalida el cache del usuario ─────────────────────────────────────────
    await this.invalidateUserCache(id);

    const responseDto = toUserResponseDto(updateResult.value);
    this.logger.log(`Usuario actualizado: ${id}`);
    return Result.ok(responseDto);
  }

  // ─── CASO DE USO: Eliminar usuario (soft-delete) ─────────────────────────────
  async deleteUser(id: string): AsyncResult<void> {
    this.logger.log(`Eliminando usuario: ${id}`);

    const deleteResult = await this.userRepository.softDelete(id);
    if (deleteResult.isFailure) return deleteResult;

    // Invalida el cache
    await this.invalidateUserCache(id);

    this.logger.log(`Usuario eliminado (soft): ${id}`);
    return Result.ok(undefined);
  }

  // ─── HELPER: Invalida el cache del usuario ────────────────────────────────────
  private async invalidateUserCache(id: string): Promise<void> {
    try {
      await this.cacheManager.del(CACHE_KEYS.USER_BY_ID(id));
      // Nota: invalidar el cache de lista es más complejo (múltiples keys)
      // En producción usarías cache tags o un patrón de versioning
    } catch {
      this.logger.warn(`Error invalidando cache para usuario ${id}`);
    }
  }
}
