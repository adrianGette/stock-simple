import { describe, expect, it } from 'vitest'
import { niceTicks } from './scale'

describe('niceTicks', () => {
  it('redondea a números limpios que cubren el máximo', () => {
    expect(niceTicks(47_546)).toEqual([0, 20_000, 40_000, 60_000])
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100])
  })

  it('maneja series vacías', () => {
    expect(niceTicks(0)).toEqual([0])
  })
})
