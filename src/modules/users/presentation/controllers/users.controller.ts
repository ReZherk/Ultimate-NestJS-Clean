import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserService } from '../../application/services/user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  GetUsersQueryDto,
  UserResponseDto,
} from '../../dto/user.dto';
import { AsyncResult } from 'src/common/result/result';
import type { PaginatedResult } from 'src/common/result/result';

@ApiTags('Users') // Agrupa endpoints bajo "Users" en Swagger
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  // POST /users → Crear usuario
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiBody({ type: CreateUserDto, description: 'Datos del usuario a crear' })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un usuario con ese email',
  })
  async createUser(
    @Body() dto: CreateUserDto,
  ): Promise<AsyncResult<UserResponseDto>> {
    return this.userService.createUser(dto);
  }

  // GET /users/:id → Obtener usuario por ID (con cache Redis)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async findUserById(
    @Param('id') id: string,
  ): Promise<AsyncResult<UserResponseDto>> {
    return this.userService.findUserById(id);
  }

  // GET /users → Listar usuarios con paginación y filtros (con cache Redis)
  @Get()
  @ApiOperation({ summary: 'Listar usuarios con paginación y filtros' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página (mínimo 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Registros por página (máximo 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda en nombre y email',
    example: 'Juan',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['admin', 'user', 'moderator'],
    description: 'Filtrar por rol',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filtrar por estado activo',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios paginada',
    type: Object, // PaginatedResult<UserResponseDto> - Swagger no soporta genéricos
  })
  async findAllUsers(
    @Query() query: GetUsersQueryDto,
  ): Promise<AsyncResult<PaginatedResult<UserResponseDto>>> {
    return this.userService.findAllUsers(query);
  }

  // PATCH /users/:id → Actualizar usuario
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un usuario existente' })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateUserDto, description: 'Campos a actualizar' })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un usuario con ese email',
  })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<AsyncResult<UserResponseDto>> {
    return this.userService.updateUser(id, dto);
  }

  // DELETE /users/:id → Eliminar usuario (soft delete)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async deleteUser(@Param('id') id: string): Promise<AsyncResult<void>> {
    return this.userService.deleteUser(id);
  }
}
