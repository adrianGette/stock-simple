import { type ReactNode, createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import styles from './Toast.module.css'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype
const DURATION_MS = 4500

/** Notificaciones apilables en un popover manual: no se cierran al tocar otra parte de la página. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const regionRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++nextId.current
      setToasts((all) => [...all.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  // Se vuelve a mostrar en cada cambio para quedar arriba de cualquier diálogo abierto después.
  useLayoutEffect(() => {
    const region = regionRef.current
    if (!region || !supportsPopover) return
    if (region.matches(':popover-open')) region.hidePopover()
    if (toasts.length) region.showPopover()
  }, [toasts])

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext value={api}>
      {children}
      <div
        ref={regionRef}
        className={[styles.region, !supportsPopover && styles.fallback].filter(Boolean).join(' ')}
        {...(supportsPopover && { popover: 'manual' })}
        role="region"
        aria-label="Notificaciones"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.kind]}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <Icon className={styles.icon} name={toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'} size={16} />
            <span className={styles.message}>{toast.message}</span>
            <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Cerrar notificación">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
