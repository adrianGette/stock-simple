import { BUSINESS_TIMEZONE, formatMoney, parsePesos } from '@stock/shared'

export { formatMoney, parsePesos }

const dateTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const time = new Intl.DateTimeFormat('es-AR', { timeZone: BUSINESS_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('es-AR', { timeZone: BUSINESS_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
const shortDay = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const integer = new Intl.NumberFormat('es-AR')
const percent = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatTime = (iso: string) => time.format(new Date(iso))
export const formatLongDate = (date: Date) => longDate.format(date)
/** Para fechas YYYY-MM-DD (días del comercio, sin hora). */
export const formatShortDay = (isoDate: string) => shortDay.format(new Date(`${isoDate}T12:00:00Z`)).replace('.', '')
export const formatInteger = (n: number) => integer.format(n)
export const formatPercent = (n: number) => `${percent.format(n)} %`
/** $ 1,2 M — para ejes y valores que no necesitan centavos. */
export const formatMoneyCompact = (cents: number) => `$ ${compact.format(cents / 100)}`


/** Centavos a texto editable: 125050 → "1250,50", 125000 → "1250". */
export function centsToInput(cents: number): string {
  const pesos = cents / 100
  return Number.isInteger(pesos) ? String(pesos) : pesos.toFixed(2).replace('.', ',')
}
