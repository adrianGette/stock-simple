import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Button } from './Button'
import styles from './Dialog.module.css'
import { Icon, type IconName } from './Icon'

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Ícono del encabezado, en un círculo con el degradado suave de marca. */
  icon?: IconName
  /** "danger" tiñe el ícono de rojo, para acciones destructivas (p. ej. anular una venta). */
  tone?: 'default' | 'danger'
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
export function Dialog({ open, onClose, title, description, icon, tone = 'default', footer, wide, dismissible = true, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() enfoca el primer botón que encuentra: la X de cerrar, que quedaría con el anillo de
      // foco como si fuera lo importante. En ese caso el foco va al diálogo mismo (el lector de pantalla
      // anuncia el título) y Tab sigue llevando a los controles. Si un campo pidió el foco, se respeta.
      if (document.activeElement?.closest('[data-dialog-close]')) dialog.focus()
    }
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
      tabIndex={-1}
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
            {icon && (
              <span className={[styles.headerIcon, tone === 'danger' && styles.danger].filter(Boolean).join(' ')} aria-hidden>
                <Icon name={icon} size={20} />
              </span>
            )}
            <div className={styles.headerText}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              iconOnly
              className={styles.close}
              onClick={onClose}
              disabled={!dismissible}
              data-dialog-close
            >
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
