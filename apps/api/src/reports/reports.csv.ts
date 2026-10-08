import {
  type CategorySalesRow,
  type CsvColumn,
  type DailySalesRow,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodRow,
  type ReportSection,
  type TopProductRow,
  csvHeader,
  csvMoney,
  csvRows,
  marginPercent,
} from '@stock/shared'

/** Margen sobre el precio de venta (%), a partir de lo facturado y la ganancia. */
const margin = (row: { revenueCents: number; profitCents: number }) =>
  marginPercent(row.revenueCents - row.profitCents, row.revenueCents)

export const DAILY_COLUMNS: CsvColumn<DailySalesRow>[] = [
  { header: 'Fecha', value: (d) => d.date },
  { header: 'Ventas', value: (d) => csvMoney(d.revenueCents) },
  { header: 'Ganancia bruta', value: (d) => csvMoney(d.profitCents) },
  { header: 'Tickets', value: (d) => d.salesCount },
]

export const CATEGORY_COLUMNS: CsvColumn<CategorySalesRow>[] = [
  { header: 'Categoría', value: (c) => c.name },
  { header: 'Ventas', value: (c) => csvMoney(c.revenueCents) },
  { header: 'Ganancia bruta', value: (c) => csvMoney(c.profitCents) },
  { header: 'Margen %', value: margin },
]

export const PAYMENT_COLUMNS: CsvColumn<PaymentMethodRow>[] = [
  { header: 'Medio de pago', value: (m) => PAYMENT_METHOD_LABELS[m.method] },
  { header: 'Ventas', value: (m) => csvMoney(m.revenueCents) },
  { header: 'Tickets', value: (m) => m.salesCount },
]

export const PRODUCT_COLUMNS: CsvColumn<TopProductRow>[] = [
  { header: 'SKU', value: (p) => p.sku },
  { header: 'Producto', value: (p) => p.name },
  { header: 'Unidades', value: (p) => p.quantity },
  { header: 'Ventas', value: (p) => csvMoney(p.revenueCents) },
  { header: 'Ganancia bruta', value: (p) => csvMoney(p.profitCents) },
  { header: 'Margen %', value: margin },
]

export const toCsv = <T>(columns: CsvColumn<T>[], rows: T[]) => csvHeader(columns) + csvRows(columns, rows)

const SECTION_FILENAMES: Record<ReportSection, string> = {
  daily: 'ventas-por-dia',
  categories: 'ventas-por-categoria',
  payments: 'medios-de-pago',
  products: 'productos-vendidos',
}

/** Ej.: "ventas-por-dia_2026-09-09_2026-10-08.csv". */
export const reportFilename = (section: ReportSection, from: string, to: string) =>
  `${SECTION_FILENAMES[section]}_${from}_${to}.csv`
