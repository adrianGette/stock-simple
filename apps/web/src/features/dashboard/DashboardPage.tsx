import { addDays, toLocalIsoDate } from '@stock/shared'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatInteger, formatLongDate, formatMoney } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { EmptyState, ErrorState, Skeleton, TilesSkeleton } from '../../shared/ui/Feedback'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import { StatTile } from '../../shared/ui/StatTile'
import { useCurrentUser } from '../auth/AuthProvider'
import { StockBadge } from '../products/StockBadge'
import { DailySalesChart } from '../reports/DailySalesChart'
import { useDashboard, useSalesReport } from '../reports/api'
import styles from './DashboardPage.module.css'

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('es-AR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }).format(now))
  return hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null
}

export function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const dashboard = useDashboard()
  // La hora se toma una vez al montar: el saludo y el rango no cambian en cada render.
  const [now] = useState(() => new Date())
  const today = toLocalIsoDate(now)
  const lastTwoWeeks = useSalesReport({ from: addDays(today, -13), to: today })

  // Tendencias de los últimos 7 días para los mini gráficos (salen del mismo reporte del gráfico).
  const week = lastTwoWeeks.data?.daily.slice(-7) ?? []
  const trend = {
    revenue: week.map((d) => d.revenueCents),
    tickets: week.map((d) => d.salesCount),
    average: week.map((d) => (d.salesCount ? d.revenueCents / d.salesCount : 0)),
    profit: week.map((d) => d.profitCents),
  }

  return (
    <Page>
      <PageHeader
        eyebrow={formatLongDate(now)}
        title={`${greeting(now)}, ${user.name.split(' ')[0]}`}
        actions={
          <Button variant="primary" icon="pos" onClick={() => navigate('/vender')}>
            Nueva venta
          </Button>
        }
      />

      {dashboard.isPending ? (
        <TilesSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <>
          <div className={styles.tiles}>
            <StatTile
              hero
              label="Ventas de hoy"
              value={formatMoney(dashboard.data.today.revenueCents, { compact: true })}
              delta={percentChange(dashboard.data.today.revenueCents, dashboard.data.yesterday.revenueCents)}
              deltaLabel="vs. ayer a esta hora"
              trend={trend.revenue}
            />
            <StatTile
              label="Tickets"
              value={formatInteger(dashboard.data.today.salesCount)}
              delta={percentChange(dashboard.data.today.salesCount, dashboard.data.yesterday.salesCount)}
              deltaLabel={`vs. ${dashboard.data.yesterday.salesCount} ayer`}
              trend={trend.tickets}
            />
            <StatTile
              label="Ticket promedio"
              value={formatMoney(dashboard.data.today.averageTicketCents, { compact: true })}
              delta={
                dashboard.data.yesterday.salesCount
                  ? percentChange(
                      dashboard.data.today.averageTicketCents,
                      dashboard.data.yesterday.revenueCents / dashboard.data.yesterday.salesCount,
                    )
                  : null
              }
              deltaLabel="vs. ayer"
              trend={trend.average}
            />
            {dashboard.data.today.profitCents !== undefined && (
              <StatTile
                label="Ganancia bruta de hoy"
                value={formatMoney(dashboard.data.today.profitCents, { compact: true })}
                hint="Últimos 7 días"
                trend={trend.profit}
              />
            )}
          </div>

          <div className={styles.grid}>
            <Card title="Últimos 14 días">
              {lastTwoWeeks.isPending ? (
                <Skeleton height="13.75rem" />
              ) : lastTwoWeeks.isError ? (
                <ErrorState error={lastTwoWeeks.error} onRetry={() => lastTwoWeeks.refetch()} />
              ) : (
                <DailySalesChart daily={lastTwoWeeks.data.daily} />
              )}
            </Card>

            <Card
              title="Stock"
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/productos?stock=low')}>
                  Ver todo
                </Button>
              }
            >
              <div className={styles.stockSummary}>
                <span className={styles.stockFigure}>
                  <strong className="tabular">{dashboard.data.stock.outCount}</strong> sin stock
                </span>
                <span className={styles.stockFigure}>
                  <strong className="tabular">{dashboard.data.stock.lowCount}</strong> stock bajo
                </span>
                {dashboard.data.stock.valueCents !== undefined && (
                  <span className={styles.stockFigure}>
                    <strong className="tabular">{formatMoney(dashboard.data.stock.valueCents, { compact: true })}</strong> inventario al costo
                  </span>
                )}
              </div>
              {dashboard.data.lowStock.length === 0 ? (
                <EmptyState icon="check" title="Todo en orden">
                  Ningún producto está por debajo de su mínimo.
                </EmptyState>
              ) : (
                <ul className={styles.lowList} aria-label="Productos para reponer">
                  {dashboard.data.lowStock.map((product) => (
                    <li key={product.id} className={styles.lowItem}>
                      <Link to={`/productos/${product.id}`}>{product.name}</Link>
                      <span className={styles.lowStock}>
                        <StockBadge stock={product.stock} minStock={product.minStock} />
                        {product.stock} / {product.minStock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </Page>
  )
}
