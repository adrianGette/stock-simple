import { Injectable } from '@nestjs/common'
import type {
  CategorySalesRow,
  DailySalesRow,
  DashboardDto,
  PaymentMethod,
  PaymentMethodRow,
  ReportExportQuery,
  ReportRange,
  SalesReportDto,
  TopProductRow,
} from '@stock/shared'
import { addDays, toLocalIsoDate } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { localDayRange, startOfLocalDay } from '../common/dates'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CATEGORY_COLUMNS, DAILY_COLUMNS, PAYMENT_COLUMNS, PRODUCT_COLUMNS, toCsv } from './reports.csv'

/** Postgres devuelve SUM/COUNT como bigint; los convertimos a number (seguro hasta 2^53). */
const num = (value: bigint | number | null): number => Number(value ?? 0)

const TOP_PRODUCTS = 10

/** Comercio, zona horaria y período ya traducido a instantes UTC: lo que necesita cada consulta. */
interface Scope {
  business: string
  tz: string
  range: ReportRange
  gte: Date
  lt: Date
}

/**
 * Reportes con SQL agregado: se calcula en la base, no trayendo miles de filas a memoria.
 * Solo cuentan ventas COMPLETED; las anuladas se informan aparte.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: RequestUser): Promise<DashboardDto> {
    const now = new Date()
    const today = toLocalIsoDate(now, user.timezone)
    const todayStart = startOfLocalDay(today, user.timezone)
    const yesterdayStart = startOfLocalDay(addDays(today, -1), user.timezone)
    // Comparamos contra "ayer a esta misma hora", no contra el día completo de ayer.
    const yesterdaySameTime = new Date(now.getTime() - 86_400_000)

    const [[sales], [stock], lowStock] = await Promise.all([
      this.prisma.$queryRaw<{ t_rev: bigint; t_count: number; t_profit: bigint; y_rev: bigint; y_count: number }[]>`
        SELECT
          COALESCE(SUM(total_cents) FILTER (WHERE created_at >= ${todayStart}), 0) AS t_rev,
          (COUNT(*) FILTER (WHERE created_at >= ${todayStart}))::int AS t_count,
          COALESCE(SUM(total_cents - cost_cents) FILTER (WHERE created_at >= ${todayStart}), 0) AS t_profit,
          COALESCE(SUM(total_cents) FILTER (WHERE created_at < ${yesterdaySameTime}), 0) AS y_rev,
          (COUNT(*) FILTER (WHERE created_at < ${yesterdaySameTime}))::int AS y_count
        FROM sales
        WHERE business_id = ${user.businessId}::uuid AND status = 'COMPLETED' AND created_at >= ${yesterdayStart}`,
      this.prisma.$queryRaw<{ low: number; out: number; value: bigint }[]>`
        SELECT
          (COUNT(*) FILTER (WHERE stock > 0 AND stock <= min_stock))::int AS low,
          (COUNT(*) FILTER (WHERE stock <= 0))::int AS out,
          COALESCE(SUM(cost_cents::bigint * GREATEST(stock, 0)), 0) AS value
        FROM products
        WHERE business_id = ${user.businessId}::uuid AND active = true`,
      this.prisma.$queryRaw<{ id: string; name: string; sku: string; stock: number; min_stock: number }[]>`
        SELECT id, name, sku, stock, min_stock FROM products
        WHERE business_id = ${user.businessId}::uuid AND active = true AND stock <= min_stock
        ORDER BY stock::float / GREATEST(min_stock, 1), name
        LIMIT 8`,
    ])

    const todayCount = sales?.t_count ?? 0
    const todayRevenue = num(sales?.t_rev ?? 0)
    return {
      today: {
        revenueCents: todayRevenue,
        salesCount: todayCount,
        averageTicketCents: todayCount ? Math.round(todayRevenue / todayCount) : 0,
        profitCents: num(sales?.t_profit ?? 0),
      },
      yesterday: { revenueCents: num(sales?.y_rev ?? 0), salesCount: sales?.y_count ?? 0 },
      stock: { lowCount: stock?.low ?? 0, outCount: stock?.out ?? 0, valueCents: num(stock?.value ?? 0) },
      lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, minStock: p.min_stock })),
    }
  }

  async sales(user: RequestUser, range: ReportRange): Promise<SalesReportDto> {
    const scope = this.scope(user, range)
    const [totals, daily, topProducts, byCategory, byPaymentMethod] = await Promise.all([
      this.totals(scope),
      this.daily(scope),
      this.productSales(scope, TOP_PRODUCTS),
      this.categorySales(scope),
      this.paymentSales(scope),
    ])
    return { range, totals, daily, topProducts, byCategory, byPaymentMethod }
  }

  /**
   * Una sección del reporte como CSV. Los datos ya vienen agregados por la base (a lo sumo un año de
   * días o un renglón por producto vendido), así que entran cómodos en memoria: no hace falta streaming.
   * A diferencia de la pantalla, "productos" trae todos los vendidos, no solo el top.
   */
  async salesCsv(user: RequestUser, { section, ...range }: ReportExportQuery): Promise<string> {
    const scope = this.scope(user, range)
    switch (section) {
      case 'daily':
        return toCsv(DAILY_COLUMNS, await this.daily(scope))
      case 'categories':
        return toCsv(CATEGORY_COLUMNS, await this.categorySales(scope))
      case 'payments':
        return toCsv(PAYMENT_COLUMNS, await this.paymentSales(scope))
      case 'products':
        return toCsv(PRODUCT_COLUMNS, await this.productSales(scope))
    }
  }

  private scope(user: RequestUser, range: ReportRange): Scope {
    return { business: user.businessId, tz: user.timezone, range, ...localDayRange(range.from, range.to, user.timezone) }
  }

  private async totals({ business, gte, lt }: Scope): Promise<SalesReportDto['totals']> {
    const [totals] = await this.prisma.$queryRaw<{ revenue: bigint; profit: bigint; count: number; voided: number }[]>`
      SELECT
        COALESCE(SUM(total_cents) FILTER (WHERE status = 'COMPLETED'), 0) AS revenue,
        COALESCE(SUM(total_cents - cost_cents) FILTER (WHERE status = 'COMPLETED'), 0) AS profit,
        (COUNT(*) FILTER (WHERE status = 'COMPLETED'))::int AS count,
        (COUNT(*) FILTER (WHERE status = 'VOIDED'))::int AS voided
      FROM sales
      WHERE business_id = ${business}::uuid AND created_at >= ${gte} AND created_at < ${lt}`
    const revenueCents = num(totals?.revenue ?? 0)
    const salesCount = totals?.count ?? 0
    return {
      revenueCents,
      profitCents: num(totals?.profit ?? 0),
      salesCount,
      averageTicketCents: salesCount ? Math.round(revenueCents / salesCount) : 0,
      voidedCount: totals?.voided ?? 0,
    }
  }

  private async daily({ business, tz, range, gte, lt }: Scope): Promise<DailySalesRow[]> {
    // generate_series completa los días sin ventas con cero, para que el gráfico no tenga huecos.
    const rows = await this.prisma.$queryRaw<{ date: string; revenue: bigint; profit: bigint; count: number }[]>`
      WITH days AS (
        SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day
      ),
      agg AS (
        SELECT (created_at AT TIME ZONE ${tz})::date AS day,
               SUM(total_cents) AS revenue,
               SUM(total_cents - cost_cents) AS profit,
               COUNT(*)::int AS count
        FROM sales
        WHERE business_id = ${business}::uuid AND status = 'COMPLETED' AND created_at >= ${gte} AND created_at < ${lt}
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
             COALESCE(agg.revenue, 0) AS revenue,
             COALESCE(agg.profit, 0) AS profit,
             COALESCE(agg.count, 0) AS count
      FROM days LEFT JOIN agg USING (day)
      ORDER BY days.day`
    return rows.map((d) => ({ date: d.date, revenueCents: num(d.revenue), profitCents: num(d.profit), salesCount: d.count }))
  }

  /** Productos vendidos en el período, de mayor a menor facturación. Sin `limit`, trae todos. */
  private async productSales({ business, gte, lt }: Scope, limit?: number): Promise<TopProductRow[]> {
    const rows = await this.prisma.$queryRaw<
      { product_id: string; name: string; sku: string; quantity: number; revenue: bigint; profit: bigint }[]
    >`
      SELECT si.product_id, MAX(si.product_name) AS name, MAX(si.sku) AS sku,
             SUM(si.quantity)::int AS quantity,
             SUM(si.subtotal_cents) AS revenue,
             SUM(si.subtotal_cents - si.unit_cost_cents * si.quantity) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${business}::uuid AND s.status = 'COMPLETED' AND s.created_at >= ${gte} AND s.created_at < ${lt}
      GROUP BY si.product_id
      ORDER BY revenue DESC, si.product_id
      ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}`
    return rows.map((p) => ({
      productId: p.product_id,
      name: p.name,
      sku: p.sku,
      quantity: p.quantity,
      revenueCents: num(p.revenue),
      profitCents: num(p.profit),
    }))
  }

  private async categorySales({ business, gte, lt }: Scope): Promise<CategorySalesRow[]> {
    const rows = await this.prisma.$queryRaw<{ category_id: string | null; name: string; revenue: bigint; profit: bigint }[]>`
      SELECT c.id AS category_id, COALESCE(c.name, 'Sin categoría') AS name,
             SUM(si.subtotal_cents) AS revenue,
             SUM(si.subtotal_cents - si.unit_cost_cents * si.quantity) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.business_id = ${business}::uuid AND s.status = 'COMPLETED' AND s.created_at >= ${gte} AND s.created_at < ${lt}
      GROUP BY c.id, c.name
      ORDER BY revenue DESC`
    return rows.map((c) => ({ categoryId: c.category_id, name: c.name, revenueCents: num(c.revenue), profitCents: num(c.profit) }))
  }

  private async paymentSales({ business, gte, lt }: Scope): Promise<PaymentMethodRow[]> {
    const rows = await this.prisma.$queryRaw<{ method: PaymentMethod; revenue: bigint; count: number }[]>`
      SELECT payment_method::text AS method, SUM(total_cents) AS revenue, COUNT(*)::int AS count
      FROM sales
      WHERE business_id = ${business}::uuid AND status = 'COMPLETED' AND created_at >= ${gte} AND created_at < ${lt}
      GROUP BY payment_method
      ORDER BY revenue DESC`
    return rows.map((m) => ({ method: m.method, revenueCents: num(m.revenue), salesCount: m.count }))
  }
}
