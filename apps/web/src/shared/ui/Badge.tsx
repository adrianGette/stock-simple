import type { ReactNode } from 'react'
import styles from './Badge.module.css'
import { Icon, type IconName } from './Icon'

interface BadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  /** Los estados nunca dependen solo del color: llevan ícono y texto. */
  icon?: IconName
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={[styles.badge, tone !== 'neutral' && styles[tone]].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
