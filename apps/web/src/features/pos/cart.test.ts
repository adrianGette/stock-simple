import { describe, expect, it } from 'vitest'
import { cartReducer, cartTotal, emptyCart, suggestedCashAmounts } from './cart'

const deck = { id: 'p1', name: 'Tabla 8.0', sku: 'TAB-01', priceCents: 465_000, stock: 2 }
const stickers = { id: 'p2', name: 'Stickers', sku: 'ACC-06', priceCents: 99_000, stock: 10 }

describe('cartReducer', () => {
  it('suma unidades del mismo producto sin superar el stock', () => {
    let state = emptyCart()
    for (let i = 0; i < 4; i++) state = cartReducer(state, { type: 'add', product: deck })
    expect(state.lines).toEqual([{ product: deck, quantity: 2 }])
  })

  it('cambia la clave de idempotencia cuando cambia el carrito', () => {
    const start = emptyCart()
    const added = cartReducer(start, { type: 'add', product: stickers })
    expect(added.saleKey).not.toBe(start.saleKey)
    // Si el agregado no tiene efecto (sin stock), la clave se conserva.
    const full = cartReducer(cartReducer(added, { type: 'setQuantity', productId: 'p2', quantity: 10 }), { type: 'add', product: stickers })
    expect(cartReducer(full, { type: 'add', product: stickers })).toBe(full)
  })

  it('quitar cantidad a 0 elimina la línea', () => {
    const state = cartReducer(cartReducer(emptyCart(), { type: 'add', product: stickers }), { type: 'setQuantity', productId: 'p2', quantity: 0 })
    expect(state.lines).toHaveLength(0)
  })

  it('calcula el total en centavos', () => {
    let state = cartReducer(emptyCart(), { type: 'add', product: deck })
    state = cartReducer(state, { type: 'add', product: stickers })
    state = cartReducer(state, { type: 'setQuantity', productId: 'p2', quantity: 3 })
    expect(cartTotal(state.lines)).toBe(465_000 + 3 * 99_000)
  })
})

describe('suggestedCashAmounts', () => {
  it('propone el exacto y billetes redondos superiores', () => {
    expect(suggestedCashAmounts(762_000)).toEqual([762_000, 800_000, 1_000_000, 2_000_000])
  })
})

describe('suggestedCashAmounts con tickets altos', () => {
  it('propone redondeos útiles para una compra de $74.800', () => {
    expect(suggestedCashAmounts(7_480_000)).toEqual([7_480_000, 7_500_000, 8_000_000, 10_000_000])
  })
})
