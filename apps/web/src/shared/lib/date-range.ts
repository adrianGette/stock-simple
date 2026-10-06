import { addDays, toLocalIsoDate } from '@stock/shared'

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'month'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'month', label: 'Este mes' },
]

/** Rango en días locales del comercio (YYYY-MM-DD), ambos extremos incluidos. */
export function rangeFor(preset: RangePreset, now = new Date()): { from: string; to: string } {
  const today = toLocalIsoDate(now)
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case '90d':
      return { from: addDays(today, -89), to: today }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}
