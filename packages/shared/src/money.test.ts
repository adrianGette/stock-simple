import { describe, expect, it } from 'vitest'
import { formatMoney, marginPercent, toCents } from './money'

describe('money', () => {
  it('convierte pesos a centavos sin perder precisión', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1250.5)).toBe(125_050)
  })

  it('formatea en pesos argentinos', () => {
    expect(formatMoney(125_050).replace(/\s/g, ' ')).toBe('$ 1.250,50')
    expect(formatMoney(125_050, { compact: true }).replace(/\s/g, ' ')).toBe('$ 1.251')
  })

  it('calcula el margen sobre el precio de venta', () => {
    expect(marginPercent(60_000, 100_000)).toBe(40)
    expect(marginPercent(110_000, 100_000)).toBe(-10)
    expect(marginPercent(1, 0)).toBeNull()
  })
})
