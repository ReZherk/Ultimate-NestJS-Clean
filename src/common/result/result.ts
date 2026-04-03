// ── Tipos de errores de negocio ──────────────────────────────────────────
// Enum con todos los posibles errores semánticos de la aplicación
// Esto es MUCHO mejor que strings o códigos numéricos arbitrarios
export enum AppErrorCode {
  // Errores de recursos
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Errores de validación
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Errores de negocio
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Errores técnicos
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ── Interface de error tipado ────────────────────────────────────────────
// Estructura que representa un error con toda la información necesaria
export interface AppError {
  code: AppErrorCode; // Código semántico del error
  message: string; // Mensaje legible para humanos
  details?: unknown; // Información adicional (opcional)
  field?: string; // Campo que causó el error (para validaciones)
}

// ── Clase Result<T> ────────────────────────────────────────────────────
// T = tipo del valor exitoso (genérico)
// La clase es sellada: solo se crea vía Result.ok() o Result.fail()
export class Result<T> {
  // ─── Propiedades privadas ────────────────────────────────────────────
  // Private + readonly: inmutabilidad garantizada
  private readonly _isSuccess: boolean;
  private readonly _value?: T;
  private readonly _error?: AppError;

  // ─── Constructor privado ─────────────────────────────────────────────
  // Solo se puede crear un Result mediante los factory methods estáticos
  // Esto garantiza que el objeto siempre es válido
  private constructor(isSuccess: boolean, value?: T, error?: AppError) {
    // Invariante: éxito sin error, o fallo con error (nunca ambos)
    if (isSuccess && error) {
      throw new Error('Result: no puede ser exitoso Y tener error');
    }
    if (!isSuccess && !error) {
      throw new Error('Result: si falla, debe tener un error');
    }

    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  // ─── Getters ─────────────────────────────────────────────────────────

  // ¿Fue exitoso?
  get isSuccess(): boolean {
    return this._isSuccess;
  }

  // Azúcar sintáctica: ¿falló? (opuesto de isSuccess)
  get isFailure(): boolean {
    return !this._isSuccess;
  }

  // El valor en caso de éxito
  // Lanza error si se intenta acceder en un Result fallido
  get value(): T {
    if (!this._isSuccess) {
      throw new Error(
        'Result: no puedes acceder al valor de un Result fallido. ' +
          'Verifica isSuccess antes de acceder a value.',
      );
    }
    // Non-null assertion: sabemos que si isSuccess=true, _value existe
    return this._value as T;
  }

  // El error en caso de fallo
  // Lanza error si se intenta acceder en un Result exitoso
  get error(): AppError {
    if (this._isSuccess) {
      throw new Error(
        'Result: no puedes acceder al error de un Result exitoso.',
      );
    }
    return this._error as AppError;
  }

  // ─── Factory Methods Estáticos ───────────────────────────────────────

  /**
   * Crea un Result exitoso con un valor
   * @example
   *   return Result.ok(user);
   *   return Result.ok(); // Para operaciones void
   */
  static ok<T>(value?: T): Result<T> {
    return new Result<T>(true, value, undefined);
  }

  /**
   * Crea un Result de fallo con un error tipado
   * @example
   *   return Result.fail({
   *     code: AppErrorCode.NOT_FOUND,
   *     message: `Usuario con id ${id} no encontrado`
   *   });
   */
  static fail<T>(error: AppError): Result<T> {
    return new Result<T>(false, undefined, error);
  }

  // ─── Helpers de errores comunes ───────────────────────────────────────
  // Factory methods para errores frecuentes (reduce código repetitivo)

  /** Shortcut: recurso no encontrado */
  static notFound<T>(resource: string, id?: string | number): Result<T> {
    return Result.fail<T>({
      code: AppErrorCode.NOT_FOUND,
      message: id
        ? `${resource} con id '${id}' no encontrado`
        : `${resource} no encontrado`,
    });
  }

  /** Shortcut: recurso ya existe */
  static alreadyExists<T>(
    resource: string,
    field: string,
    value: string,
  ): Result<T> {
    return Result.fail<T>({
      code: AppErrorCode.ALREADY_EXISTS,
      message: `Ya existe un ${resource} con ${field}: ${value}`,
      field,
    });
  }

  /** Shortcut: error interno genérico */
  static internalError<T>(message: string, details?: unknown): Result<T> {
    return Result.fail<T>({
      code: AppErrorCode.INTERNAL_ERROR,
      message,
      details,
    });
  }

  // ─── Métodos funcionales ──────────────────────────────────────────────

  /**
   * map: transforma el valor si es exitoso (patrón functor)
   * @example
   *   const result = Result.ok(user);
   *   const mapped = result.map(u => u.email); // Result<string>
   */
  map<U>(fn: (value: T) => U): Result<U> {
    if (this._isSuccess) {
      return Result.ok<U>(fn(this._value as T));
    }
    // Si falló, propaga el error sin transformar
    return Result.fail<U>(this._error as AppError);
  }

  /**
   * getOrElse: obtiene el valor o un default si falló
   * @example
   *   const users = result.getOrElse([]);
   */
  getOrElse(defaultValue: T): T {
    return this._isSuccess ? (this._value as T) : defaultValue;
  }
}

// ── Tipos de utilidad ─────────────────────────────────────────────────────
// AsyncResult: shortcut para Promise<Result<T>>
// Se usa como tipo de retorno en servicios asíncronos
export type AsyncResult<T> = Promise<Result<T>>;
