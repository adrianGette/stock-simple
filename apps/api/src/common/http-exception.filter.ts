import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { type ApiErrorBody, type ErrorCode, PRODUCT_IMPORT_MAX_BYTES } from '@stock/shared'
import type { Response } from 'express'
import { Prisma } from '../generated/prisma/client'
import { AppError } from './app-error'

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
}

/** Normaliza cualquier error a la forma `ApiErrorBody`, sin filtrar detalles internos. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException')

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const body = this.toBody(exception)
    response.status(body.statusCode).json(body)
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof AppError) {
      return exception.getResponse() as ApiErrorBody
    }
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Esperá un minuto y volvé a probar.' }
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      return { statusCode: status, code: CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR', message: this.messageFor(status, exception.message) }
    }
    // body-parser corta los cuerpos que superan su límite antes de llegar al controlador (p. ej. un CSV de importación).
    if (isBodyTooLarge(exception)) {
      const megabytes = Math.round(PRODUCT_IMPORT_MAX_BYTES / 1024 / 1024)
      return { statusCode: 413, code: 'FILE_TOO_LARGE', message: `El archivo supera el máximo de ${megabytes} MB.` }
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos' }
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, code: 'NOT_FOUND', message: 'El registro no existe' }
      }
    }
    this.logger.error(exception instanceof Error ? exception.stack : exception)
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' }
  }

  private messageFor(status: number, fallback: string): string {
    switch (status) {
      case 401:
        return 'Tu sesión venció. Volvé a ingresar.'
      case 403:
        return 'No tenés permiso para hacer esto'
      case 404:
        return 'El recurso no existe'
      default:
        return fallback
    }
  }
}

function isBodyTooLarge(exception: unknown): boolean {
  return typeof exception === 'object' && exception !== null && 'type' in exception && exception.type === 'entity.too.large'
}
