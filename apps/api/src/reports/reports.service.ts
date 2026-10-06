import { Injectable } from '@nestjs/common'
import type {
  CategorySalesRow,
  DailySalesRow,
  DashboardDto,
  PaymentMethod,
  PaymentMethodRow,
  ReportRange,
  SalesReportDto,
  TopProductRow,
} from '@stock/shared'
import { addDays, toLocalIsoDate } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { localDayRange, startOfLocalDay } from '../common/dates'
import { PrismaService } from '../prisma/prisma.service'

/** Postgres devuelve SUM/COUNT como bigint; los convertimos a number (seguro hasta 2^53). */
const num = (value: bigint | number | null): number => Number(value ?? 0)

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
    const { gte, lt } = localDayRange(range.from, range.to, user.timezone)
    const tz = user.timezone
    const business = user.businessId

    const [[totals], daily, topProducts, byCategory, byPayment] = await Promise.all([
      this.prisma.$queryRaw<{ revenue: bigint; profit: bigint; count: number; voided: number }[]>`
        SELECT
          COALESCE(SUM(total_cents) FILTER (WHERE status = 'COMPLETED'), 0) AS revenue,
          COALESCE(SUM(total_cents - cost_cents) FILTER (WHERE status = 'COMPLETED'), 0) AS profit,
          (COUNT(*) FILTER (WHERE status = 'COMPLETED'))::int AS count,
          (COUNT(*) FILTER (WHERE status = 'VOIDED'))::int AS voided
        FROM sales
        WHERE business_id = ${business}::uuid AND created_at >= ${gte} AND created_at < ${lt}`,
      // generate_series completa los días sin ventas con cero, para que el gráfico no tenga huecos.
      this.prisma.$queryRaw<{ date: string; revenue: bigint; profit: bigint; count: number }[]>`
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
        ORDER BY days.day`,
      this.prisma.$queryRaw<{ product_id: string; name: string; sku: string; quantity: number; revenue: bigint; profit: bigint }[]>`
        SELECT si.product_id, MAX(si.product_name) AS name, MAX(si.sku) AS sku,
               SUM(si.quantity)::int AS quantity,
               SUM(si.subtotal_cents) AS revenue,
               SUM(si.subtotal_cents - si.unit_cost_cents * si.quantity) AS profit
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ${business}::uuid AND s.status = 'COMPLETED' AND s.created_at >= ${gte} AND s.created_at < ${lt}
        GROUP BY si.product_id
        ORDER BY revenue DESC
        LIMIT 10`,
      this.prisma.$queryRaw<{ category_id: string | null; name: string; revenue: bigint; profit: bigint }[]>`
        SELECT c.id AS category_id, COALESCE(c.name, 'Sin categoría') AS name,
               SUM(si.subtotal_cents) AS revenue,
               SUM(si.subtotal_cents - si.unit_cost_cents * si.quantity) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.business_id = ${business}::uuid AND s.status = 'COMPLETED' AND s.created_at >= ${gte} AND s.created_at < ${lt}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ method: PaymentMethod; revenue: bigint; count: number }[]>`
        SELECT payment_method::text AS method, SUM(total_cents) AS revenue, COUNT(*)::int AS count
        FROM sales
        WHERE business_id = ${business}::uuid AND status = 'COMPLETED' AND created_at >= ${gte} AND created_at < ${lt}
        GROUP BY payment_method
        ORDER BY revenue DESC`,
    ])

    const revenueCents = num(totals?.revenue ?? 0)
    const salesCount = totals?.count ?? 0
    return {
      range,
      totals: {
        revenueCents,
        profitCents: num(totals?.profit ?? 0),
        salesCount,
        averageTicketCents: salesCount ? Math.round(revenueCents / salesCount) : 0,
        voidedCount: totals?.voided ?? 0,
      },
      daily: daily.map((d): DailySalesRow => ({ date: d.date, revenueCents: num(d.revenue), profitCents: num(d.profit), salesCount: d.count })),
      topProducts: topProducts.map(
        (p): TopProductRow => ({
          productId: p.product_id,
          name: p.name,
          sku: p.sku,
          quantity: p.quantity,
          revenueCents: num(p.revenue),
          profitCents: num(p.profit),
        }),
      ),
      byCategory: byCategory.map(
        (c): CategorySalesRow => ({ categoryId: c.category_id, name: c.name, revenueCents: num(c.revenue), profitCents: num(c.profit) }),
      ),
      byPaymentMethod: byPayment.map((m): PaymentMethodRow => ({ method: m.method, revenueCents: num(m.revenue), salesCount: m.count })),
    }
  }
}
