const randomUUID = () => crypto.randomUUID()
import { describe, expect, it } from 'vitest'
import '../index'
import { createProductSchema } from './products'
import { createSaleSchema } from './sales'
import { stockAdjustmentSchema } from './stock'

describe('createSaleSchema', () => {
  const productId = randomUUID()

  it('rechaza productos repetidos', () => {
    const result = createSaleSchema.safeParse({
      idempotencyKey: randomUUID(),
      paymentMethod: 'CASH',
      items: [
        { productId, quantity: 1 },
        { productId, quantity: 2 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rechaza ventas vacías', () => {
    const result = createSaleSchema.safeParse({ idempotencyKey: randomUUID(), paymentMethod: 'CASH', items: [] })
    expect(result.error?.issues[0]?.message).toBe('Agregá al menos un producto')
  })
})

describe('createProductSchema', () => {
  it('normaliza el SKU y completa valores por defecto', () => {
    const product = createProductSchema.parse({ name: 'Remera Logo · M', sku: ' rem-01-m ', costCents: 100, priceCents: 200 })
    expect(product).toMatchObject({ sku: 'REM-01-M', barcode: null, categoryId: null, minStock: 0, initialStock: 0 })
  })

  it('valida el código de barras', () => {
    const result = createProductSchema.safeParse({ name: 'Remera', sku: 'R1', barcode: '12ab', costCents: 1, priceCents: 2 })
    expect(result.success).toBe(false)
  })
})

describe('stockAdjustmentSchema', () => {
  it('exige motivo para pérdidas', () => {
    expect(stockAdjustmentSchema.safeParse({ type: 'LOSS', quantity: 2, note: '' }).success).toBe(false)
    expect(stockAdjustmentSchema.safeParse({ type: 'LOSS', quantity: 2, note: 'Vencido' }).success).toBe(true)
  })
})
