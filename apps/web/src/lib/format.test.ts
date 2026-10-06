import { describe, expect, it } from 'vitest'
import { centsToInput, parsePesos } from './format'

describe('parsePesos', () => {
  it.each([
    ['1250', 125_000],
    ['1.250', 125_000],
    ['1.250,50', 125_050],
    ['1250,5', 125_050],
    ['1250.50', 125_050],
    ['$ 3.790', 379_000],
    ['0,99', 99],
  ])('interpreta "%s"', (input, cents) => {
    expect(parsePesos(input)).toBe(cents)
  })

  it.each(['', 'abc', '12,345', '-5'])('rechaza "%s"', (input) => {
    expect(parsePesos(input)).toBeNull()
  })

  it('ida y vuelta con centsToInput', () => {
    expect(parsePesos(centsToInput(125_050))).toBe(125_050)
    expect(centsToInput(125_000)).toBe('1250')
  })
})
