import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
  cloneElement,
  isValidElement,
  useId,
} from 'react'
import styles from './Field.module.css'
import { Icon } from './Icon'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  /**
   * Un único control (Input, Select, MoneyInput…): Field le conecta id y atributos ARIA.
   * Si el control está envuelto (p. ej. en un Controller), usá la forma de función.
   */
  children: ReactNode | ((props: ControlProps) => ReactNode)
}

export interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/**
 * Etiqueta + control + ayuda + error, accesible por defecto: el control recibe `id`,
 * `aria-describedby` y `aria-invalid`. La ayuda va arriba del control para que el teclado
 * del celular no la tape; el error aparece recién después de interactuar (modo onTouched).
 */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const controlProps: ControlProps = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }
  const control =
    typeof children === 'function'
      ? children(controlProps)
      : isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, { ...controlProps })
        : children

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label} {optional && <span className={styles.optional}>(opcional)</span>}
      </label>
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {control}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          <Icon name="alert" size={14} /> {error}
        </span>
      )}
    </div>
  )
}

type WithRef<T, E> = T & { ref?: Ref<E> }

export function Input({ className, ...props }: WithRef<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) {
  return <input className={[styles.control, className].filter(Boolean).join(' ')} {...props} />
}

export function SearchInput({ className, ...props }: WithRef<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) {
  return (
    <div className={[styles.affix, className].filter(Boolean).join(' ')}>
      <span className={styles.prefix}>
        <Icon name="search" size={16} />
      </span>
      <input type="search" className={styles.control} {...props} />
    </div>
  )
}

/** El desplegable propio de la app (reemplaza al <select> nativo). */
export { Select } from './Select'

export function Textarea({ className, ...props }: WithRef<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) {
  return <textarea className={[styles.control, className].filter(Boolean).join(' ')} {...props} />
}

export const fieldStyles = styles
