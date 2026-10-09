import { useId } from 'react'
import styles from './charts.module.css'

/**
 * Mini gráfico de tendencia, sin ejes ni etiquetas: muestra la forma (sube, baja, se mantiene).
 * Toma el color del texto que lo rodea (currentColor), así funciona sobre fondo claro y sobre el degradado.
 * Es decorativo: el número y su variación están escritos al lado.
 */
export function Sparkline({ values }: { values: number[] }) {
  const gradientId = useId()
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  // Lienzo de 100 × 32; un margen arriba y abajo para que el trazo no se corte.
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 28 - ((value - min) / range) * 24] as const)
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

  return (
    <svg className={styles.sparkline} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
