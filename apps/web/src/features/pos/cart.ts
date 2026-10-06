import type { ProductDto } from '@stock/shared'

export interface CartLine {
  product: Pick<ProductDto, 'id' | 'name' | 'sku' | 'priceCents' | 'stock'>
  quantity: number
}

export interface CartState {
  lines: CartLine[]
  /**
   * Clave de idempotencia de la venta en curso. Se mantiene mientras el carrito no cambie,
   * así un reintento tras un error de red no duplica la venta; cualquier cambio genera otra.
   */
  saleKey: string
}

export type CartAction =
  | { type: 'add'; product: CartLine['product'] }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }

export const emptyCart = (): CartState => ({ lines: [], saleKey: crypto.randomUUID() })

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.lines.find((line) => line.product.id === action.product.id)
      if (existing && existing.quantity >= action.product.stock) return state
      const lines = existing
        ? state.lines.map((line) =>
            line.product.id === action.product.id ? { product: action.product, quantity: line.quantity + 1 } : line,
          )
        : [...state.lines, { product: action.product, quantity: 1 }]
      return { lines, saleKey: crypto.randomUUID() }
    }
    case 'setQuantity': {
      const lines = state.lines
        .map((line) =>
          line.product.id === action.productId
            ? { ...line, quantity: Math.min(Math.max(0, Math.trunc(action.quantity)), line.product.stock) }
            : line,
        )
        .filter((line) => line.quantity > 0)
      return { lines, saleKey: crypto.randomUUID() }
    }
    case 'remove':
      return { lines: state.lines.filter((line) => line.product.id !== action.productId), saleKey: crypto.randomUUID() }
    case 'clear':
      return emptyCart()
  }
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
}

export function cartUnits(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/** Atajos para "paga con": el monto exacto y los redondeos que suele entregar el cliente. */
export function suggestedCashAmounts(totalCents: number): number[] {
  const bills = [1_000, 10_000, 20_000, 50_000].map((pesos) => pesos * 100)
  const roundUps = bills.map((bill) => Math.ceil(totalCents / bill) * bill).filter((amount) => amount > totalCents)
  return [totalCents, ...new Set(roundUps)].toSorted((a, b) => a - b).slice(0, 4)
}
