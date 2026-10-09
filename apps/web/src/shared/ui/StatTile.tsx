import type { ReactNode } from 'react'
import { formatPercent } from '../../lib/format'
import { Sparkline } from '../charts/Sparkline'
import { Icon } from './Icon'
import styles from './StatTile.module.css'

interface StatTileProps {
  label: string
  value: ReactNode
  /** Variación porcentual contra un período nombrado en `deltaLabel`. */
  delta?: number | null
  deltaLabel?: string
  hint?: ReactNode
  /** Valores recientes, del más viejo al más nuevo, para el mini gráfico de tendencia. */
  trend?: number[]
  hero?: boolean
}

export function StatTile({ label, value, delta, deltaLabel, hint, trend, hero }: StatTileProps) {
  const direction = delta == null || Math.round(delta * 10) === 0 ? null : delta > 0 ? 'up' : 'down'
  return (
    <div className={[styles.tile, hero && styles.hero].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {(delta != null || hint) && (
        <span className={styles.meta}>
          {delta != null && (
            <span className={[styles.delta, direction && styles[direction]].filter(Boolean).join(' ')}>
              {direction && <Icon name={direction === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />}
              {delta > 0 ? '+' : ''}
              {formatPercent(delta)}
            </span>
          )}
          {delta != null && deltaLabel && <span className={styles.hint}>{deltaLabel}</span>}
          {hint && <span className={styles.hint}>{hint}</span>}
        </span>
      )}
      {trend && trend.length > 1 && (
        <span className={styles.trend}>
          <Sparkline values={trend} />
        </span>
      )}
    </div>
  )
}
