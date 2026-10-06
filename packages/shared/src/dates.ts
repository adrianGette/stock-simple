export const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires'

/** Fecha local del comercio en formato YYYY-MM-DD. */
export function toLocalIsoDate(date: Date, timeZone = BUSINESS_TIMEZONE): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Suma días a una fecha YYYY-MM-DD sin depender de la zona horaria del entorno. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
