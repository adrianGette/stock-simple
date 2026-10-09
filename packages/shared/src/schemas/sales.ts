import { z } from 'zod'
import { SORT_DIRECTIONS, id, isoDate, pagination } from './common'
import type { UserRef } from './common'

export const PAYMENT_METHODS = ['CASH', 'DEBIT', 'CREDIT', 'TRANSFER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  TRANSFER: 'Transferencia',
}

export const createSaleSchema = z.object({
  /**
   * Clave que genera el cliente por cada intento de venta. Si la red falla y
   * el POS reintenta, la API devuelve la misma venta en lugar de duplicarla.
   */
  idempotencyKey: z.uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  items: z
    .array(
      z.object({
        productId: id,
        quantity: z.number().int().min(1, 'Mínimo 1 unidad').max(9_999),
      }),
    )
    .min(1, 'Agregá al menos un producto')
    .max(100, 'Máximo 100 productos por venta')
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, 'Hay productos repetidos'),
})
export type CreateSaleInput = z.infer<typeof createSaleSchema>

export const SALE_STATUSES = ['COMPLETED', 'VOIDED'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

/** Columnas de la tabla de ventas por las que se puede ordenar. */
export const SALE_SORTS = ['number', 'date', 'seller', 'items', 'total'] as const
export type SaleSort = (typeof SALE_SORTS)[number]

export const saleQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    status: z.enum([...SALE_STATUSES, 'ALL']).default('ALL'),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    userId: id.optional(),
    // Por defecto, las más recientes primero.
    sort: z.enum(SALE_SORTS).default('date'),
    dir: z.enum(SORT_DIRECTIONS).default('desc'),
    ...pagination,
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'La fecha inicial es posterior a la final', path: ['from'] })
export type SaleQuery = z.infer<typeof saleQuerySchema>

export const voidSaleSchema = z.object({
  reason: z.string().trim().min(3, 'Contá brevemente el motivo').max(200, 'Máximo 200 caracteres'),
})
export type VoidSaleInput = z.infer<typeof voidSaleSchema>

export interface SaleItemDto {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  unitCostCents?: number
}

export interface SaleSummaryDto {
  id: string
  number: number
  status: SaleStatus
  paymentMethod: PaymentMethod
  totalCents: number
  itemCount: number
  user: UserRef
  createdAt: string
}

export interface SaleDto extends SaleSummaryDto {
  items: SaleItemDto[]
  /** Solo para roles con permiso `products:view-cost`. */
  costCents?: number
  voidedAt: string | null
  voidReason: string | null
  voidedBy: UserRef | null
}
