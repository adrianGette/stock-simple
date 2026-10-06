import { describe, expect, it } from 'vitest'
import { localDayRange, startOfLocalDay } from './dates'

describe('dates', () => {
  it('el día en Buenos Aires empieza a las 03:00 UTC', () => {
    expect(startOfLocalDay('2026-10-05', 'America/Argentina/Buenos_Aires').toISOString()).toBe('2026-10-05T03:00:00.000Z')
  })

  it('arma un rango semiabierto que incluye el último día completo', () => {
    const range = localDayRange('2026-10-01', '2026-10-05', 'America/Argentina/Buenos_Aires')
    expect(range.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(range.lt.toISOString()).toBe('2026-10-06T03:00:00.000Z')
  })
})
