/**
 * El dinero se maneja siempre en centavos enteros para evitar errores de
 * punto flotante (0.1 + 0.2 !== 0.3). Solo se convierte a pesos al mostrarlo.
 */
export type Cents = number

export const MAX_CENTS = 100_000_000_000 // $1.000 millones

export function toCents(pesos: number): Cents {
  return Math.round(pesos * 100)
}

export function fromCents(cents: Cents): number {
  return cents / 100
}

const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const currencyCompact = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Formatea centavos como pesos argentinos: 125050 → "$ 1.250,50". */
export function formatMoney(cents: Cents, { compact = false } = {}): string {
  return (compact ? currencyCompact : currency).format(cents / 100)
}

/** Interpreta lo que escribe el usuario en pesos ("1.250,50", "1250.5") y devuelve centavos. */
export function parsePesos(input: string): number | null {
  const cleaned = input.replace(/[$\s]/g, '')
  if (!cleaned) return null
  // Formato argentino: punto de miles y coma decimal. Si solo hay punto con 1-2 decimales, es decimal.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : /^\d+\.\d{1,2}$/.test(cleaned)
      ? cleaned
      : cleaned.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/**
 * Margen sobre precio de venta, en porcentaje con un decimal.
 * Devuelve null cuando el precio es 0 (no hay margen definible).
 */
export function marginPercent(costCents: Cents, priceCents: Cents): number | null {
  if (priceCents <= 0) return null
  return Math.round(((priceCents - costCents) / priceCents) * 1000) / 10
}
