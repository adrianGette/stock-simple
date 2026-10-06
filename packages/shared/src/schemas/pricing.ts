import { z } from 'zod'
import { ROUNDING_DIRECTIONS, ROUNDING_STEPS } from '../pricing'
import { id } from './common'

export const PRICE_TARGETS = ['price', 'cost', 'both'] as const
export type PriceTarget = (typeof PRICE_TARGETS)[number]

export const bulkPriceUpdateSchema = z
  .object({
    /** null = todas las categorías. */
    categoryId: id.nullable().default(null),
    /** Si se envía, limita a estos productos (dentro de la categoría elegida). */
    productIds: z.array(id).max(1000).optional(),
    percent: z
      .number({ error: 'Ingresá un porcentaje' })
      .min(-90, 'La rebaja máxima es 90 %')
      .max(500, 'El aumento máximo es 500 %')
      .refine((n) => n !== 0, 'El porcentaje no puede ser 0'),
    roundTo: z.literal(ROUNDING_STEPS).default(1000),
    direction: z.enum(ROUNDING_DIRECTIONS).default('up'),
    target: z.enum(PRICE_TARGETS).default('price'),
  })
export type BulkPriceUpdateInput = z.input<typeof bulkPriceUpdateSchema>
export type BulkPriceUpdate = z.infer<typeof bulkPriceUpdateSchema>

export interface PricePreviewRow {
  productId: string
  sku: string
  name: string
  category: string | null
  oldPriceCents: number
  newPriceCents: number
  oldCostCents: number
  newCostCents: number
  oldMargin: number | null
  newMargin: number | null
}

export interface PricePreviewDto {
  rows: PricePreviewRow[]
  count: number
}

export interface PriceUpdateResultDto {
  batchId: string
  updated: number
}
