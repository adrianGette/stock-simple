import { Body, HttpStatus, type PipeTransform, Query, applyDecorators } from '@nestjs/common'
import { ApiBody, ApiQuery } from '@nestjs/swagger'
import { z } from 'zod'
import { AppError } from './app-error'

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', details[0]?.message ?? 'Datos inválidos', details)
    }
    return result.data
  }
}

type JsonSchema = { properties?: Record<string, object>; required?: string[] }

function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' }) as JsonSchema
}

/** Valida el body con un esquema de @stock/shared. */
export const ZodBody = (schema: z.ZodType) => Body(new ZodValidationPipe(schema))

/** Valida la query string con un esquema de @stock/shared. */
export const ZodQuery = (schema: z.ZodType) => Query(new ZodValidationPipe(schema))

/** Documenta en Swagger el body a partir del mismo esquema Zod que lo valida. */
export const ApiZodBody = (schema: z.ZodType) => ApiBody({ schema: toJsonSchema(schema) })

export const ApiZodQuery = (schema: z.ZodType) => {
  const json = toJsonSchema(schema)
  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, property]) =>
      ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: property }),
    ),
  )
}
