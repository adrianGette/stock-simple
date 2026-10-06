import { type InputHTMLAttributes, useState } from 'react'
import { centsToInput, parsePesos } from '../../lib/format'
import styles from './Field.module.css'

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor en centavos. `null` = vacío. */
  value: number | null
  onChange: (cents: number | null) => void
}

/** El usuario escribe en pesos con formato local ("1.250,50"); el formulario recibe centavos. */
export function MoneyInput({ value, onChange, onBlur, className, ...props }: MoneyInputProps) {
  const [text, setText] = useState(value === null ? '' : centsToInput(value))
  const [lastValue, setLastValue] = useState(value)

  // Si el valor cambia desde afuera (reset, atajos de "paga con"), se ajusta el texto durante el render.
  if (!Object.is(value, lastValue)) {
    setLastValue(value)
    const parsed = parsePesos(text)
    if (parsed !== value && !(value !== null && Number.isNaN(value))) setText(value === null ? '' : centsToInput(value))
  }

  return (
    <div className={[styles.affix, className].filter(Boolean).join(' ')}>
      <span className={styles.prefix}>$</span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${styles.control} tabular`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          onChange(parsePesos(event.target.value) ?? (event.target.value.trim() ? Number.NaN : null))
        }}
        onBlur={(event) => {
          const cents = parsePesos(text)
          if (cents !== null) setText(centsToInput(cents))
          onBlur?.(event)
        }}
      />
    </div>
  )
}
