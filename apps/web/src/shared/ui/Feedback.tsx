import type { ReactNode } from 'react'
import { errorMessage } from '../../lib/api-client'
import { Button } from './Button'
import styles from './Feedback.module.css'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon = 'box', title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.icon}>
        <Icon name={icon} size={20} />
      </span>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.spinner} aria-hidden />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

/**
 * Esqueletos de carga: bloques con un brillo que se desliza, con la forma del contenido que viene.
 * La pantalla no "salta" cuando llegan los datos y se entiende qué se está cargando.
 */
export function Skeleton({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden />
}

export function TableSkeleton({ rows = 6, columns = 4, label = 'Cargando…' }: { rows?: number; columns?: number; label?: string }) {
  return (
    <div className={styles.tableSkeleton} role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_row, row) => (
        <div key={row} className={styles.skeletonRow} style={{ gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)` }}>
          {Array.from({ length: columns }, (_cell, column) => (
            <Skeleton key={column} width={column === 0 ? '70%' : '55%'} height="0.875rem" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function TilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.tilesSkeleton} role="status">
      <span className="visually-hidden">Cargando…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.tileSkeleton}>
          <Skeleton width="45%" height="0.75rem" />
          <Skeleton width="70%" height="1.75rem" />
          <Skeleton width="100%" height="2rem" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.icon} ${styles.errorIcon}`}>
        <Icon name="alert" size={20} />
      </span>
      <p className={styles.title}>No pudimos cargar los datos</p>
      <p className={styles.text}>{errorMessage(error)}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button size="sm" onClick={onRetry} icon="undo">
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
