import styles from './charts.module.css'

export interface BarDatum {
  key: string
  label: string
  value: number
}

interface BarListProps {
  data: BarDatum[]
  formatValue: (value: number) => string
  /** Muestra el porcentaje sobre el total junto al valor. */
  showShare?: boolean
}

/** Barras horizontales de una serie con el valor rotulado en la punta (no hace falta leyenda ni hover). */
export function BarList({ data, formatValue, showShare }: BarListProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  return (
    <ul className={styles.bars}>
      {data.map((datum) => (
        <li key={datum.key} className={styles.barRow}>
          <span className={styles.barLabel} title={datum.label}>
            {datum.label}
          </span>
          <span className={styles.barTrack} aria-hidden>
            <span className={styles.bar} style={{ display: 'block', width: `${(datum.value / max) * 100}%` }} />
          </span>
          <span className={styles.barValue}>
            {formatValue(datum.value)}
            {showShare && <span className={styles.barShare}>{Math.round((datum.value / total) * 100)} %</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
