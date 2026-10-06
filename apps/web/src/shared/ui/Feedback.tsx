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
