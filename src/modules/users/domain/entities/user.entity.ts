import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

@Entity('users')
export class UserEntity {
  @PrimaryColumn({
    type: 'uuid',
    comment: 'Identificador único universal del usuario',
  })
  id: string;

  // ─── Nombre ───────────────────────────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 100, // Máximo 100 caracteres
    nullable: false, // NOT NULL en la BD
    comment: 'Nombre del usuario',
  })
  firstName: string; // TypeORM convierte camelCase a snake_case: first_name

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    comment: 'Apellido del usuario',
  })
  lastName: string;

  // ─── Email──────────────────────────────────────────
  @Index({ unique: true }) // Índice único: no puede haber dos users con el mismo email
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: 'Email único del usuario',
  })
  email: string;

  // ─── Contraseña (hasheada) ─────────────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    select: false, //TypeORM NO incluye este campo en SELECT por defecto
    // Esto previene que la contraseña se devuelva en las queries accidentalmente
    comment: 'Hash bcrypt de la contraseña (nunca se devuelve en queries)',
  })
  password: string;

  // ─── Rol ──────────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: UserRole, // TypeORM crea el tipo ENUM en PostgreSQL
    default: UserRole.USER, // Valor por defecto: usuario normal
    comment: 'Rol del usuario en el sistema',
  })
  role: UserRole;

  // ─── Estado ───────────────────────────────────────────────────────────
  @Column({
    type: 'boolean',
    default: true,
    comment: 'Si el usuario está activo en el sistema',
  })
  isActive: boolean;

  // ─── Campos de auditoría (auto-gestionados por TypeORM) ───────────────

  // CreateDateColumn: TypeORM establece este campo automáticamente al INSERT
  @CreateDateColumn({
    type: 'timestamptz', // timestamptz = timestamp WITH timezone (recomendado)
    comment: 'Fecha de creación del registro',
  })
  createdAt: Date;

  // UpdateDateColumn: TypeORM actualiza este campo automáticamente al UPDATE
  @UpdateDateColumn({
    type: 'timestamptz',
    comment: 'Fecha de última actualización',
  })
  updatedAt: Date;

  // DeleteDateColumn: para SOFT DELETE
  // null = usuario activo, fecha = usuario "eliminado" (pero aún en BD)
  // TypeORM excluye automáticamente registros con deletedAt != null
  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
    comment: 'Fecha de eliminación lógica (null = activo)',
  })
  deletedAt: Date | null;

  // ─── Hooks de ciclo de vida ────────────────────────────────────────────

  // @BeforeInsert: se ejecuta ANTES de que TypeORM haga el INSERT
  // Aquí generamos el UUID y hasheamos la contraseña
  @BeforeInsert()
  async beforeInsert(): Promise<void> {
    // Genera UUID v4 si no tiene uno
    // Esto permite que el servicio asigne el ID antes de persistir
    if (!this.id) {
      this.id = uuidv4();
    }

    // Normaliza el email: siempre en minúsculas
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }

    // Hashea la contraseña SOLO si no está ya hasheada
    // bcrypt hashes siempre empiezan con '$2b$'
    if (this.password && !this.password.startsWith('$2b$')) {
      const saltRounds = 12; // Factor de costo: más alto = más seguro pero más lento
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  // @BeforeUpdate: se ejecuta ANTES de que TypeORM haga el UPDATE
  @BeforeUpdate()
  async beforeUpdate(): Promise<void> {
    // Si se está actualizando la contraseña, vuelve a hashearla
    if (this.password && !this.password.startsWith('$2b$')) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }

    // Normaliza el email si se actualizó
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }

  // ─── Métodos de dominio ───────────────────────────────────────────────
  // Métodos que encapsulan lógica de negocio del dominio

  /** Nombre completo del usuario */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /** Verifica si una contraseña en texto plano coincide con el hash */
  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }

  /** Desactiva el usuario (en lugar de eliminarlo) */
  deactivate(): void {
    this.isActive = false;
  }

  /** Activa un usuario desactivado */
  activate(): void {
    this.isActive = true;
  }
}
