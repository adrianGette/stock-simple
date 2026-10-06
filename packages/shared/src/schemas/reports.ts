import { z } from 'zod'
import { isoDate } from './common'
import type { PaymentMethod } from './sales'

export const reportRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: 'La fecha inicial es posterior a la final', path: ['from'] })
  .refine(
    (v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 366,
    { message: 'El rango máximo es de un año', path: ['to'] },
  )
export type ReportRange = z.infer<typeof reportRangeSchema>

export interface DashboardDto {
  today: { revenueCents: number; salesCount: number; averageTicketCents: number; profitCents?: number }
  yesterday: { revenueCents: number; salesCount: number }
  stock: { lowCount: number; outCount: number; valueCents?: number }
  /** Hasta 8 productos con stock bajo, ordenados por urgencia. */
  lowStock: { id: string; name: string; sku: string; stock: number; minStock: number }[]
}

export interface DailySalesRow {
  date: string
  revenueCents: number
  profitCents: number
  salesCount: number
}

export interface TopProductRow {
  productId: string
  name: string
  sku: string
  quantity: number
  revenueCents: number
  profitCents: number
}

export interface CategorySalesRow {
  categoryId: string | null
  name: string
  revenueCents: number
  profitCents: number
}

export interface PaymentMethodRow {
  method: PaymentMethod
  revenueCents: number
  salesCount: number
}

export interface SalesReportDto {
  range: ReportRange
  totals: { revenueCents: number; profitCents: number; salesCount: number; averageTicketCents: number; voidedCount: number }
  daily: DailySalesRow[]
  topProducts: TopProductRow[]
  byCategory: CategorySalesRow[]
  byPaymentMethod: PaymentMethodRow[]
}
