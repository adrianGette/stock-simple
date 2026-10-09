import type { ReactNode } from 'react'
import styles from './Layout.module.css'

export function Page({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>
}

interface PageHeaderProps {
  title: string
  eyebrow?: ReactNode
  subtitle?: ReactNode
  /** Datos del registro debajo del título (no va dentro del párrafo del subtítulo: puede tener listas y botones). */
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, eyebrow, subtitle, meta, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}

interface CardProps {
  title?: string
  description?: ReactNode
  action?: ReactNode
  /** Sin padding lateral en el cuerpo: para tablas que van de borde a borde. */
  flush?: boolean
  className?: string
  children: ReactNode
}

export function Card({ title, description, action, flush, className, children }: CardProps) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(' ')} aria-label={title}>
      {(title || action) && (
        <header className={styles.cardHeader}>
          <div>
            {title && <h2 className={styles.cardTitle}>{title}</h2>}
            {description && <p className={styles.cardDescription}>{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? styles.flush : styles.cardBody}>{children}</div>
    </section>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>
}

export const layoutStyles = styles
