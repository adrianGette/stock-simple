import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Button } from './Button'
import styles from './Dialog.module.css'

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  wide?: boolean
  /** Evita cerrar con clic afuera (p. ej. mientras se guarda). */
  dismissible?: boolean
  children: ReactNode
}

/**
 * Diálogo modal sobre `<dialog>` nativo: `showModal()` da top layer, foco atrapado y Esc
 * sin JavaScript propio. `closedby="any"` agrega cierre con clic en el fondo; donde el
 * navegador aún no lo soporta (Safari) se replica con un listener.
 */
export function Dialog({ open, onClose, title, description, footer, wide, dismissible = true, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || supportsClosedBy || !dismissible) return
    const onClick = (event: MouseEvent) => {
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      const inside =
        rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right
      if (!inside) dialog.close()
    }
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [dismissible])

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, wide && styles.wide].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Esc y clic afuera disparan `close`: sincronizamos el estado de React.
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      {...{ closedby: dismissible ? 'any' : 'none' }}
    >
      {open && (
        <>
          <header className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose} disabled={!dismissible}>
              Cerrar
            </Button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </>
      )}
    </dialog>
  )
}
