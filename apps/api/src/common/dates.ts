import { addDays } from '@stock/shared'

/** Offset en minutos de una zona horaria para un instante dado (ej. -180 para Buenos Aires). */
function offsetMinutes(timeZone: string, at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? '')
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

/** Instante UTC en que empieza el día `isoDate` en la zona horaria del comercio. */
export function startOfLocalDay(isoDate: string, timeZone: string): Date {
  const utcMidnight = new Date(`${isoDate}T00:00:00Z`)
  return new Date(utcMidnight.getTime() - offsetMinutes(timeZone, utcMidnight) * 60_000)
}

/** Rango semiabierto [desde, hasta) en UTC que cubre los días locales indicados. */
export function localDayRange(from: string, to: string, timeZone: string): { gte: Date; lt: Date } {
  return { gte: startOfLocalDay(from, timeZone), lt: startOfLocalDay(addDays(to, 1), timeZone) }
}
