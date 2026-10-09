import { z } from 'zod'
import { cents } from './common'
import type { UserRef } from './common'

const note = z.string().trim().max(200, 'Máximo 200 caracteres')

/**
 * Tres formas de mover stock a mano:
 * - PURCHASE: entra mercadería (opcionalmente actualiza el costo).
 * - LOSS: rotura, vencimiento o robo; exige un motivo.
 * - COUNT: recuento físico; se informa lo contado y la API calcula la diferencia.
 */
export const stockAdjustmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PURCHASE'),
    quantity: z.number().int().min(1, 'Mínimo 1 unidad').max(1_000_000),
    unitCostCents: cents.optional(),
    note: note.optional(),
  }),
  z.object({
    type: z.literal('LOSS'),
    quantity: z.number().int().min(1, 'Mínimo 1 unidad').max(1_000_000),
    note: note.min(3, 'Contá brevemente el motivo'),
  }),
  z.object({
    type: z.literal('COUNT'),
    countedStock: z.number().int().min(0, 'No puede ser negativo').max(1_000_000),
    note: note.optional(),
  }),
])
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>

export const STOCK_MOVEMENT_TYPES = ['INITIAL', 'PURCHASE', 'SALE', 'SALE_VOID', 'LOSS', 'COUNT'] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  INITIAL: 'Stock inicial',
  PURCHASE: 'Ingreso de mercadería',
  SALE: 'Venta',
  SALE_VOID: 'Anulación de venta',
  LOSS: 'Pérdida',
  COUNT: 'Recuento',
}

export interface StockMovementDto {
  id: string
  type: StockMovementType
  /** Diferencia con signo: positiva si entra, negativa si sale. */
  quantity: number
  stockAfter: number
  note: string | null
  saleNumber: number | null
  user: UserRef
  createdAt: string
}

export interface PriceChangeDto {
  id: string
  oldPriceCents: number
  newPriceCents: number
  oldCostCents: number
  newCostCents: number
  reason: 'MANUAL' | 'BULK' | 'PURCHASE'
  user: UserRef
  createdAt: string
}

/** Columnas de la planilla de conteo. "Stock del sistema" es el stock al descargarla; "Contado" la completa quien cuenta. */
export const COUNT_CSV_HEADERS = {
  sku: 'SKU',
  name: 'Nombre',
  category: 'Categoría',
  systemStock: 'Stock del sistema',
  counted: 'Contado',
} as const
export type CountCsvField = keyof typeof COUNT_CSV_HEADERS

export interface InventoryCountLine {
  row: number
  sku: string
  name: string
  /** Stock del sistema cuando se descargó la planilla. */
  systemStock: number
  /** Stock del sistema ahora: si difiere, hubo movimientos (p. ej. ventas) mientras se contaba. */
  currentStock: number
  counted: number
  /** Lo que falta (negativo) o sobra respecto de la planilla. Es lo que se registra como movimiento. */
  difference: number
  /** Stock final: el actual más la diferencia, así las ventas posteriores al conteo quedan descontadas. */
  stockAfter: number
}

/** Resultado de revisar una planilla de conteo. No guarda nada. */
export interface InventoryCountPreviewDto {
  /** Filas con datos (sin el encabezado). */
  rows: number
  /** Productos con diferencia: se les registra un movimiento de conteo. */
  toAdjust: number
  /** Productos donde lo contado coincide con la planilla: no se tocan. */
  matching: number
  /** Filas con "Contado" vacío: no se tocan. */
  skipped: number
  /** Productos contados que tuvieron movimientos desde que se descargó la planilla. */
  movedSince: number
  /** Detalle de los productos con diferencia o con movimientos posteriores, hasta un máximo. */
  lines: InventoryCountLine[]
  errors: { row: number | null; message: string }[]
  errorCount: number
}

export interface InventoryCountResultDto {
  adjusted: number
}
