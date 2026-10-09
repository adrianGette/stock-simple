import type { ReactNode } from 'react'
import styles from './Steps.module.css'

/** Pasos de un proceso: números en círculos unidos por una línea, en vez de una lista numerada común. */
export function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className={styles.steps}>
      {children.map((step, index) => (
        <li key={index} className={styles.step}>
          <span className={styles.number} aria-hidden>
            {index + 1}
          </span>
          <span className={styles.text}>{step}</span>
        </li>
      ))}
    </ol>
  )
}
