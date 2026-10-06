import { describe, expect, it } from 'vitest'
import { adjustAmount } from './pricing'

describe('adjustAmount', () => {
  it('aplica el porcentaje sin redondeo', () => {
    expect(adjustAmount(100_000, { percent: 12.5, roundTo: 1, direction: 'up' })).toBe(112_500)
  })

  it('no suma un paso de más por errores de punto flotante', () => {
    // 1000 * 1.1 = 1100.0000000000002 en JS
    expect(adjustAmount(1_000, { percent: 10, roundTo: 1, direction: 'up' })).toBe(1_100)
    expect(adjustAmount(100_000, { percent: 10, roundTo: 1000, direction: 'up' })).toBe(110_000)
  })

  it('redondea hacia arriba al múltiplo de $10', () => {
    // $1.234 + 7 % = $1.320,38 → $1.330
    expect(adjustAmount(123_400, { percent: 7, roundTo: 1000, direction: 'up' })).toBe(133_000)
  })

  it('redondea al más cercano', () => {
    // $1.320,38 → $1.320
    expect(adjustAmount(123_400, { percent: 7, roundTo: 1000, direction: 'nearest' })).toBe(132_000)
    // $1.375 → $1.400 con paso de $50 (1.375 / 50 = 27,5 → 28)
    expect(adjustAmount(125_000, { percent: 10, roundTo: 5000, direction: 'nearest' })).toBe(140_000)
  })

  it('aplica rebajas', () => {
    expect(adjustAmount(200_000, { percent: -15, roundTo: 10000, direction: 'nearest' })).toBe(170_000)
  })

  it('nunca devuelve montos negativos', () => {
    expect(adjustAmount(100, { percent: -90, roundTo: 10000, direction: 'nearest' })).toBe(0)
  })
})
