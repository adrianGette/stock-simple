import { useCallback, useSyncExternalStore } from 'react'

/**
 * Paletas de acento. Índigo es la de siempre; las demás redefinen los tokens del acento en
 * styles/palettes.css. Las muestras son los dos extremos del degradado de cada una.
 */
export const PALETTES = [
  { value: 'indigo', label: 'Índigo', swatch: ['#4f46e5', '#7c3aed'] },
  { value: 'ocean', label: 'Océano', swatch: ['#0369a1', '#06b6d4'] },
  { value: 'graphite', label: 'Grafito', swatch: ['#18181b', '#71717a'] },
] as const

export type Palette = (typeof PALETTES)[number]['value']

/** La misma clave que lee el script de index.html antes del primer pintado. */
const STORAGE_KEY = 'color-palette'

function current(): Palette {
  const value = document.documentElement.dataset.palette
  return value === 'ocean' || value === 'graphite' ? value : 'indigo'
}

const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Paleta elegida en este dispositivo, como el modo claro u oscuro. Índigo no se guarda: es la de base. */
export function usePalette(): { palette: Palette; setPalette: (palette: Palette) => void } {
  const palette = useSyncExternalStore(subscribe, current)

  const setPalette = useCallback((next: Palette) => {
    const root = document.documentElement
    if (next === 'indigo') delete root.dataset.palette
    else root.dataset.palette = next
    try {
      if (next === 'indigo') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sin almacenamiento (modo privado estricto): la paleta vale hasta recargar.
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { palette, setPalette }
}
