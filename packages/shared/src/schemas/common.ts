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

/** Dirección de orden de las tablas: ascendente (A a Z, menor a mayor) o descendente. */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface UserRef {
  id: string
  name: string
  /** Versión de la foto de perfil (cuándo cambió); null si no tiene foto. */
  photoVersion: string | null
}

/** Foto de perfil: la web la recorta a un cuadrado de este lado y la sube como WebP. */
export const PROFILE_PHOTO_SIZE = 256
export const PROFILE_PHOTO_MAX_BYTES = 200 * 1024
