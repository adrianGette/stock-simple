import { PAYMENT_METHOD_LABELS, marginPercent } from '@stock/shared'
import { useState } from 'react'
import { formatInteger, formatMoney, formatPercent } from '../../lib/format'
import { BarList } from '../../shared/charts/BarList'
import { type RangePreset, RANGE_PRESETS, rangeFor } from '../../shared/lib/date-range'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { StatTile } from '../../shared/ui/StatTile'
import table from '../../shared/ui/table.module.css'
import { DailySalesChart } from './DailySalesChart'
import styles from './ReportsPage.module.css'
import { useSalesReport } from './api'

const PRESETS = RANGE_PRESETS.filter((p) => p.value !== 'today')

export function ReportsPage() {
  const [preset, setPreset] = useState<RangePreset>('30d')
  const report = useSalesReport(rangeFor(preset))

  return (
    <Page>
      <PageHeader title="Reportes" subtitle="Cómo vienen las ventas, qué deja más ganancia y cómo te pagan." />
      {/* Un solo filtro arriba de todo: todos los números de la página responden al mismo período. */}
      <SegmentedControl label="Período" value={preset} options={PRESETS} onChange={setPreset} />

      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <div className={report.isPlaceholderData ? styles.refreshing : undefined} style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {(() => {
            const { totals } = report.data
            const margin = marginPercent(totals.revenueCents - totals.profitCents, totals.revenueCents)
            return (
              <div className={styles.tiles}>
                <StatTile label="Ventas" value={formatMoney(totals.revenueCents, { compact: true })} />
                <StatTile label="Ganancia bruta" value={formatMoney(totals.profitCents, { compact: true })} hint={margin !== null ? `Margen ${formatPercent(margin)}` : undefined} />
                <StatTile label="Tickets" value={formatInteger(totals.salesCount)} hint={totals.voidedCount ? `${totals.voidedCount} anuladas` : undefined} />
                <StatTile label="Ticket promedio" value={formatMoney(totals.averageTicketCents, { compact: true })} />
              </div>
            )
          })()}

          <div className={styles.grid}>
            <Card title="Ventas por día" className={styles.wide}>
              <DailySalesChart daily={report.data.daily} height={260} />
            </Card>

            <Card title="Por categoría" description="Ventas del período">
              {report.data.byCategory.length ? (
                <BarList
                  showShare
                  formatValue={(v) => formatMoney(v, { compact: true })}
                  data={report.data.byCategory.map((c) => ({ key: c.categoryId ?? 'none', label: c.name, value: c.revenueCents }))}
                />
              ) : (
                <EmptyState title="Sin ventas en el período" />
              )}
            </Card>

            <Card title="Medios de pago" description="Ventas del período">
              {report.data.byPaymentMethod.length ? (
                <BarList
                  showShare
                  formatValue={(v) => formatMoney(v, { compact: true })}
                  data={report.data.byPaymentMethod.map((m) => ({ key: m.method, label: PAYMENT_METHOD_LABELS[m.method], value: m.revenueCents }))}
                />
              ) : (
                <EmptyState title="Sin ventas en el período" />
              )}
            </Card>

            <Card title="Productos que más venden" flush className={styles.wide}>
              {report.data.topProducts.length ? (
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col" className={table.num}>
                        Unidades
                      </th>
                      <th scope="col" className={table.num}>
                        Ventas
                      </th>
                      <th scope="col" className={table.num}>
                        Ganancia
                      </th>
                      <th scope="col" className={table.num}>
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.topProducts.map((p, index) => {
                      const margin = marginPercent(p.revenueCents - p.profitCents, p.revenueCents)
                      return (
                        <tr key={p.productId}>
                          <td className={table.full}>
                            <span className={table.primaryCell}>
                              {index + 1}. {p.name}
                            </span>
                            <span className={`${table.secondaryText} mono`}>{p.sku}</span>
                          </td>
                          <td data-label="Unidades" className={table.num}>
                            {formatInteger(p.quantity)}
                          </td>
                          <td data-label="Ventas" className={table.num}>
                            {formatMoney(p.revenueCents)}
                          </td>
                          <td data-label="Ganancia" className={table.num}>
                            {formatMoney(p.profitCents)}
                          </td>
                          <td data-label="Margen" className={table.num}>
                            {margin === null ? '—' : formatPercent(margin)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin ventas en el período" />
              )}
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}
