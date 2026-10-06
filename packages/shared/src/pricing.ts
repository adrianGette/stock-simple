import type { Cents } from './money'

/** Pasos de redondeo disponibles, en centavos: sin redondeo, $1, $10, $50, $100. */
export const ROUNDING_STEPS = [1, 100, 1000, 5000, 10000] as const
export type RoundingStep = (typeof ROUNDING_STEPS)[number]

export const ROUNDING_DIRECTIONS = ['up', 'nearest'] as const
export type RoundingDirection = (typeof ROUNDING_DIRECTIONS)[number]

export interface PriceAdjustment {
  /** Porcentaje a aplicar. 12.5 sube un 12,5 %; -10 baja un 10 %. */
  percent: number
  roundTo: RoundingStep
  direction: RoundingDirection
}

/**
 * Aplica un aumento (o rebaja) porcentual a un monto y lo redondea.
 *
 * Es la misma función que usa la API para guardar y la web para previsualizar,
 * así lo que ve el usuario es exactamente lo que se aplica.
 */
export function adjustAmount(amount: Cents, { percent, roundTo, direction }: PriceAdjustment): Cents {
  // toFixed limpia el ruido de punto flotante (1000 * 1.1 = 1100.0000000000002)
  // antes de redondear hacia arriba, que si no sumaría un paso de más.
  const raw = Number(((amount * (100 + percent)) / 100).toFixed(6))
  const steps = direction === 'up' ? Math.ceil(raw / roundTo) : Math.round(raw / roundTo)
  return Math.max(0, steps * roundTo)
}

export const ROUNDING_LABELS: Record<RoundingStep, string> = {
  1: 'Sin redondeo',
  100: 'A $1',
  1000: 'A $10',
  5000: 'A $50',
  10000: 'A $100',
}
