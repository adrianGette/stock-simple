import { useEffect, useRef, useState } from 'react'
import styles from './CopyButton.module.css'
import { Icon } from './Icon'
import { useToast } from './Toast'

/** Botón chico para copiar un código (SKU, código de barras) sin tener que seleccionarlo a mano. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.')
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => void copy()}
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
      title={copied ? 'Copiado' : `Copiar ${label}`}
      data-copied={copied || undefined}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </button>
  )
}
