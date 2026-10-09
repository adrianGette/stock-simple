export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'SKU_TAKEN',
  'BARCODE_TAKEN',
  'EMAIL_TAKEN',
  'CATEGORY_NAME_TAKEN',
  'CATEGORY_NOT_EMPTY',
  'INSUFFICIENT_STOCK',
  'PRODUCT_INACTIVE',
  'SALE_ALREADY_VOIDED',
  'CANNOT_MODIFY_SELF',
  'DEMO_READ_ONLY',
  'IMPORT_INVALID',
  'FILE_TOO_LARGE',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Forma de todas las respuestas de error de la API. */
export interface ApiErrorBody {
  statusCode: number
  code: ErrorCode
  message: string
  details?: unknown
}
