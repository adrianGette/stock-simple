import {
  Children,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Icon } from './Icon'
import styles from './Select.module.css'

interface Option {
  value: string
  label: string
  disabled: boolean
}

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  /** Opciones como en un <select>: <option value="…">Texto</option>. */
  children: ReactNode
  id?: string
  name?: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  onBlur?: () => void
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }> => isValidElement(child))
    .map((child) => ({
      value: String(child.props.value ?? ''),
      label: Children.toArray(child.props.children).join(''),
      disabled: Boolean(child.props.disabled),
    }))
}

/**
 * Desplegable con el estilo de la app, en lugar del menú del sistema operativo. Se usa como un
 * <select> (con <option> adentro) y se maneja igual con el teclado: flechas, Inicio/Fin, Enter,
 * Esc y escribir una letra para saltar a la opción que empieza con ella.
 *
 * La lista es un popover nativo: queda arriba de todo (también dentro de un diálogo) y se cierra
 * sola al tocar afuera o con Esc.
 */
export function Select({ value, onValueChange, children, id, name, disabled, className, style, onBlur, ...aria }: SelectProps) {
  const options = readOptions(children)
  const selected = options.find((option) => option.value === value)
  const baseId = useId()
  const listId = `${baseId}-list`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const typeahead = useRef({ text: '', at: 0 })
  // Al elegir con Enter o Espacio el foco vuelve al botón, y el resto de esa misma pulsación (Chrome
  // activa botones en keypress con Enter y en keyup con Espacio) lo volvería a abrir. Se ignora.
  const ignoreActivation = useRef(false)

  // Antes de mostrarse, la lista se ubica pegada al botón (o arriba, si abajo no hay lugar).
  useEffect(() => {
    const list = listRef.current
    const button = buttonRef.current
    if (!list || !button) return
    const onBeforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== 'open') return
      const rect = button.getBoundingClientRect()
      const listHeight = Math.min(list.scrollHeight, 288)
      const below = window.innerHeight - rect.bottom
      const openUp = below < listHeight + 16 && rect.top > below
      list.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 192) - 8))}px`
      list.style.minWidth = `${rect.width}px`
      list.style.top = openUp ? `${rect.top - listHeight - 6}px` : `${rect.bottom + 6}px`
    }
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === 'open'
      setOpen(isOpen)
      if (isOpen) {
        setActive(Math.max(0, options.findIndex((option) => option.value === value)))
        list.focus()
      } else if (list.contains(document.activeElement) || document.activeElement === document.body) {
        button.focus()
      }
    }
    list.addEventListener('beforetoggle', onBeforeToggle)
    list.addEventListener('toggle', onToggle)
    return () => {
      list.removeEventListener('beforetoggle', onBeforeToggle)
      list.removeEventListener('toggle', onToggle)
    }
  })

  // Si la página se desplaza o cambia de tamaño, la lista quedaría desfasada: se cierra.
  useEffect(() => {
    if (!open) return
    const close = () => listRef.current?.hidePopover()
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  // La opción activa siempre a la vista al moverse con el teclado.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`#${CSS.escape(`${baseId}-${active}`)}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, baseId])

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    if (option.value !== value) onValueChange(option.value)
    ignoreActivation.current = true
    setTimeout(() => (ignoreActivation.current = false), 400)
    listRef.current?.hidePopover()
    // Al elegir, el foco vuelve al botón en el acto (no se espera al evento "toggle" del popover).
    buttonRef.current?.focus()
  }

  function move(from: number, step: 1 | -1): number {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i]?.disabled) return i
    return from
  }

  /**
   * Escribir salta a la opción que empieza con ese texto, como en un <select>: "tra" va a
   * Transferencia; y repetir la misma letra ("t", "t") recorre todas las que empiezan con ella.
   */
  function jumpTo(char: string, from: number): number | null {
    const now = Date.now()
    const state = typeahead.current
    state.text = now - state.at < 700 ? state.text + char.toLowerCase() : char.toLowerCase()
    state.at = now
    const repeated = [...state.text].every((letter) => letter === state.text[0])
    const search = repeated ? state.text[0]! : state.text
    const matches = options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !option.disabled && option.label.toLowerCase().startsWith(search))
      .map(({ index }) => index)
    if (matches.length === 0) return null
    // Con la misma letra repetida, la siguiente coincidencia después de la actual (y vuelve a empezar).
    return repeated ? (matches.find((index) => index > from) ?? matches[0]!) : matches[0]!
  }

  function onListKeyDown(event: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((current) => move(current, 1)),
      ArrowUp: () => setActive((current) => move(current, -1)),
      Home: () => setActive(move(-1, 1)),
      End: () => setActive(move(options.length, -1)),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Tab: () => listRef.current?.hidePopover(),
    }
    const action = keys[event.key]
    if (action) {
      if (event.key !== 'Tab') event.preventDefault()
      action()
    } else if (event.key.length === 1) {
      const index = jumpTo(event.key, active)
      if (index !== null) setActive(index)
    }
  }

  function onButtonKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      // El foco pasa a la lista en el acto: si se esperara al evento "toggle" (asincrónico), la tecla
      // siguiente podría llegarle todavía al botón.
      listRef.current?.showPopover()
      listRef.current?.focus()
    } else if (event.key.length === 1 && event.key !== ' ') {
      // Con la lista cerrada, escribir cambia la opción directamente.
      const index = jumpTo(event.key, options.findIndex((option) => option.value === value))
      if (index !== null) choose(index)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        name={name}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        style={style}
        disabled={disabled}
        popoverTarget={listId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onKeyDown={onButtonKeyDown}
        onClick={(event) => {
          // Cancela la apertura (popovertarget) que dispararía la misma tecla con la que se eligió.
          if (ignoreActivation.current) event.preventDefault()
        }}
        onBlur={onBlur}
        {...aria}
        // La etiqueta (aria-label o <label>) le da el nombre al botón y tapa su texto: el valor elegido
        // se conecta como descripción, para que el lector de pantalla lo anuncie como en un <select>.
        aria-describedby={[`${baseId}-value`, aria['aria-describedby']].filter(Boolean).join(' ')}
      >
        <span id={`${baseId}-value`} className={styles.value}>
          {selected?.label ?? ''}
        </span>
        <Icon name="chevronDown" size={16} className={styles.chevron} />
      </button>
      <div
        ref={listRef}
        id={listId}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        aria-label={aria['aria-label']}
        aria-activedescendant={open ? `${baseId}-${active}` : undefined}
        className={styles.list}
        onKeyDown={onListKeyDown}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${baseId}-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={[styles.option, index === active && styles.active].filter(Boolean).join(' ')}
            onPointerMove={() => !option.disabled && setActive(index)}
            onClick={() => choose(index)}
            onKeyDown={(event) => event.key === 'Enter' && choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <Icon name="check" size={16} className={styles.check} />}
          </div>
        ))}
      </div>
    </>
  )
}
