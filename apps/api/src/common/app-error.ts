import { HttpException, HttpStatus } from '@nestjs/common'
import type { ApiErrorBody, ErrorCode } from '@stock/shared'

/** Error de negocio con un código estable que el frontend puede interpretar. */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details } satisfies ApiErrorBody, status)
  }

  static notFound(what: string): AppError {
    return new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} no existe`)
  }

  static conflict(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(HttpStatus.CONFLICT, code, message, details)
  }

  static unprocessable(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details)
  }
}
