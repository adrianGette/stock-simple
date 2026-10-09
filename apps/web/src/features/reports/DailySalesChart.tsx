import type { DailySalesRow } from '@stock/shared'
import { useState } from 'react'
import { formatInteger, formatMoney, formatMoneyCompact, formatShortDay } from '../../lib/format'
import { ColumnChart, tooltipStyles } from '../../shared/charts/ColumnChart'
import { Button } from '../../shared/ui/Button'
import table from '../../shared/ui/table.module.css'

interface DailySalesChartProps {
  daily: DailySalesRow[]
  showProfit?: boolean
  height?: number
}

/** Ventas por día con alternativa en tabla: el gráfico nunca es la única forma de leer los datos. */
export function DailySalesChart({ daily, showProfit = true, height }: DailySalesChartProps) {
  const [asTable, setAsTable] = useState(false)
  const data = daily.map((d) => ({ ...d, key: d.date, label: formatShortDay(d.date), value: d.revenueCents }))
  const total = daily.reduce((sum, d) => sum + d.revenueCents, 0)

  return (
    // minmax(0, 1fr): la columna nunca se ensancha por el SVG, así el gráfico puede volver a achicarse.
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'calc(-1 * var(--space-2))' }}>
        <Button size="sm" variant="ghost" icon={asTable ? 'chart' : 'layers'} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </Button>
      </div>
      {asTable ? (
        <div style={{ maxHeight: height ?? 260, overflowY: 'auto' }}>
          <table className={table.table}>
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col" className={table.num}>
                  Ventas
                </th>
                {showProfit && (
                  <th scope="col" className={table.num}>
                    Ganancia
                  </th>
                )}
                <th scope="col" className={table.num}>
                  Tickets
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date}>
                  <td data-label="Día">{formatShortDay(d.date)}</td>
                  <td data-label="Ventas" className={table.num}>
                    {formatMoney(d.revenueCents)}
                  </td>
                  {showProfit && (
                    <td data-label="Ganancia" className={table.num}>
                      {formatMoney(d.profitCents)}
                    </td>
                  )}
                  <td data-label="Tickets" className={table.num}>
                    {d.salesCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ColumnChart
          data={data}
          height={height}
          ariaLabel={`Ventas por día: ${daily.length} días, total ${formatMoney(total)}. Usá las flechas para recorrer los días.`}
          formatTick={formatMoneyCompact}
          // Los períodos siempre terminan hoy: el último día queda resaltado.
          highlightLast
          renderTooltip={(d) => (
            <>
              <span className={tooltipStyles.title}>{formatShortDay(d.date)}</span>
              <span className={tooltipStyles.value}>{formatMoney(d.revenueCents)}</span>
              {showProfit && (
                <span className={tooltipStyles.row}>
                  <span>Ganancia</span>
                  <span>{formatMoney(d.profitCents)}</span>
                </span>
              )}
              <span className={tooltipStyles.row}>
                <span>Tickets</span>
                <span>{formatInteger(d.salesCount)}</span>
              </span>
            </>
          )}
        />
      )}
    </div>
  )
}
