/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
   El gráfico es enfocable para recorrer los días con las flechas; los mismos datos están en la vista de tabla. */
import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import styles from './charts.module.css'
import { niceTicks } from './scale'
import { useElementWidth } from './useElementWidth'

export interface ColumnDatum {
  key: string
  label: string
  value: number
}

interface ColumnChartProps<T extends ColumnDatum> {
  data: T[]
  /** Descripción accesible del gráfico (los valores están además en la vista de tabla). */
  ariaLabel: string
  height?: number
  formatTick: (value: number) => string
  renderTooltip: (datum: T) => ReactNode
  /** Resalta la última columna (p. ej. el día de hoy) con el color de acento. */
  highlightLast?: boolean
}

const MARGIN = { top: 8, right: 4, bottom: 24, left: 56 }
const MAX_BAR = 24
const RADIUS = 4

/** Columna con extremo superior redondeado (4px) y base recta sobre el eje. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height)
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}

/**
 * Gráfico de columnas de una serie, en SVG propio: sin dependencias, con tooltip al pasar el
 * mouse o al navegar con las flechas del teclado (el gráfico es enfocable).
 */
export function ColumnChart<T extends ColumnDatum>({
  data,
  ariaLabel,
  height = 220,
  formatTick,
  renderTooltip,
  highlightLast = false,
}: ColumnChartProps<T>) {
  // Ids únicos para los degradados: puede haber varios gráficos en la misma pantalla.
  const gradientId = useId()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = height - MARGIN.top - MARGIN.bottom
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 0))
  const max = ticks[ticks.length - 1] || 1
  const band = data.length ? innerWidth / data.length : 0
  const barWidth = Math.max(2, Math.min(MAX_BAR, band - 2)) // 2px de aire entre columnas
  const y = (value: number) => MARGIN.top + innerHeight - (value / max) * innerHeight
  // Etiquetas del eje X espaciadas para que nunca se pisen.
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(band, 1)))

  const onKeyDown = (event: KeyboardEvent) => {
    if (!data.length) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) => Math.min(data.length - 1, Math.max(0, (current ?? (step > 0 ? -1 : data.length)) + step)))
    }
    if (event.key === 'Escape') setActive(null)
  }

  const activeDatum = active !== null ? data[active] : undefined

  return (
    <div
      ref={ref}
      className={styles.chart}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden>
          <defs>
            <linearGradient id={`${gradientId}-soft`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.softTop} />
              <stop offset="1" className={styles.softBottom} />
            </linearGradient>
            <linearGradient id={`${gradientId}-strong`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.strongTop} />
              <stop offset="1" className={styles.strongBottom} />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className={tick === 0 ? styles.baseline : styles.grid} x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
              <text className={styles.tick} x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {data.map((datum, index) => {
            const x = MARGIN.left + index * band + (band - barWidth) / 2
            const top = y(datum.value)
            return (
              <g key={datum.key}>
                {datum.value > 0 && (
                  <path
                    className={styles.column}
                    fill={`url(#${gradientId}-${index === active || (highlightLast && index === data.length - 1) ? 'strong' : 'soft'})`}
                    d={columnPath(x, top, barWidth, MARGIN.top + innerHeight - top)}
                  />
                )}
                {index % labelEvery === 0 && (
                  <text className={styles.tick} x={x + barWidth / 2} y={height - 6} textAnchor="middle">
                    {datum.label}
                  </text>
                )}
                {/* Área de hover: toda la franja de la columna, más grande que la marca. */}
                <rect
                  x={MARGIN.left + index * band}
                  y={MARGIN.top}
                  width={band}
                  height={innerHeight}
                  fill="transparent"
                  onPointerEnter={() => setActive(index)}
                  onPointerMove={() => setActive(index)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {activeDatum && active !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(Math.max(MARGIN.left + active * band + band / 2, 90), width - 90),
            top: Math.max(0, y(activeDatum.value) - 84),
          }}
          aria-live="polite"
        >
          {renderTooltip(activeDatum)}
        </div>
      )}
    </div>
  )
}

export const tooltipStyles = { title: styles.tooltipTitle, value: styles.tooltipValue, row: styles.tooltipRow }
