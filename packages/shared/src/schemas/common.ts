import { z } from 'zod'
import { MAX_CENTS } from '../money'

export const id = z.uuid({ error: 'Identificador inválido' })

export const cents = z
  .number({ error: 'Ingresá un monto' })
  .int('El monto debe estar en centavos enteros')
  .min(0, 'El monto no puede ser negativo')
  .max(MAX_CENTS, 'El monto es demasiado alto')

export const isoDate = z.iso.date({ error: 'Fecha inválida (AAAA-MM-DD)' })

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface UserRef {
  id: string
  name: string
}
