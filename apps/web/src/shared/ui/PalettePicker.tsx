import { useId } from 'react'
import { PALETTES, usePalette } from '../hooks/usePalette'
import styles from './PalettePicker.module.css'

/** Elegir la paleta de colores: radios nativos (flechas para moverse) con una muestra de cada degradado. */
export function PalettePicker() {
  const { palette, setPalette } = usePalette()
  const name = useId()

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>Color</legend>
      <div className={styles.options}>
        {PALETTES.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={palette === option.value}
              onChange={() => setPalette(option.value)}
              className={styles.input}
            />
            <span
              className={styles.swatch}
              style={{ background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})` }}
              aria-hidden
            />
            <span className={styles.label}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
