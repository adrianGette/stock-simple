import { addDays, toLocalIsoDate } from '@stock/shared'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatInteger, formatLongDate, formatMoney } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
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
        <LoadingState />
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
            />
            <StatTile
              label="Tickets"
              value={formatInteger(dashboard.data.today.salesCount)}
              hint={`Ayer a esta hora: ${dashboard.data.yesterday.salesCount}`}
            />
            <StatTile label="Ticket promedio" value={formatMoney(dashboard.data.today.averageTicketCents, { compact: true })} />
            {dashboard.data.today.profitCents !== undefined && (
              <StatTile label="Ganancia bruta de hoy" value={formatMoney(dashboard.data.today.profitCents, { compact: true })} />
            )}
          </div>

          <div className={styles.grid}>
            <Card title="Últimos 14 días">
              {lastTwoWeeks.isPending ? (
                <LoadingState />
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
