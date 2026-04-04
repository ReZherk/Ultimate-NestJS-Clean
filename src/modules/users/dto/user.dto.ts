import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserEntity, UserRole } from '../domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORM HELPERS (tipados correctamente)
// ─────────────────────────────────────────────────────────────────────────────
const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimLowerCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

const toBooleanFromString = ({ value }: TransformFnParams): unknown =>
  value === 'true' || value === true;

// ─────────────────────────────────────────────────────────────────────────────
// CREATE USER DTO
// ─────────────────────────────────────────────────────────────────────────────
export class CreateUserDto {
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  @Transform(trimString)
  firstName: string;

  @ApiProperty({ example: 'Pérez', minLength: 2, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(trimString)
  lastName: string;

  @ApiProperty({
    description: 'Email único del usuario',
    example: 'juan.perez@ejemplo.com',
  })
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(trimLowerCase)
  email: string;

  @ApiProperty({
    description:
      'Contraseña: mínimo 8 chars, 1 mayúscula, 1 número, 1 especial',
    example: 'MiClave123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(255)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'La contraseña debe tener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: `El rol debe ser uno de: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE USER DTO
// ─────────────────────────────────────────────────────────────────────────────
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: 'Estado activo/inactivo del usuario' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY / FILTER DTO
// ─────────────────────────────────────────────────────────────────────────────
export class GetUsersQueryDto {
  @ApiPropertyOptional({ description: 'Página actual', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda en nombre y email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  search?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Filtrar por rol' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @Transform(toBooleanFromString)
  @IsBoolean()
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────
export class UserResponseDto {
  @ApiProperty({ description: 'UUID del usuario' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: UserEntity): UserResponseDto {
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
  }
}
