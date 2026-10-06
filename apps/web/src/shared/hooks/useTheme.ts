import { useCallback, useSyncExternalStore } from 'react'

type Scheme = 'light' | 'dark'
const STORAGE_KEY = 'color-scheme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function pinned(): Scheme | null {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : null
}

function current(): Scheme {
  return pinned() ?? (media.matches ? 'dark' : 'light')
}

const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  media.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', listener)
  }
}

/**
 * Toggle de dos estados: por defecto se sigue al sistema; al tocarlo se fija el tema
 * opuesto. Si el elegido coincide con el del sistema, se vuelve a "seguir al sistema".
 */
export function useTheme(): { scheme: Scheme; toggle: () => void } {
  const scheme = useSyncExternalStore(subscribe, current)

  const toggle = useCallback(() => {
    const next: Scheme = current() === 'dark' ? 'light' : 'dark'
    const system: Scheme = media.matches ? 'dark' : 'light'
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
    try {
      if (next === system) {
        delete document.documentElement.dataset.theme
        if (meta) meta.content = 'light dark'
        localStorage.removeItem(STORAGE_KEY)
      } else {
        document.documentElement.dataset.theme = next
        if (meta) meta.content = next
        localStorage.setItem(STORAGE_KEY, next)
      }
    } catch {
      document.documentElement.dataset.theme = next
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { scheme, toggle }
}
