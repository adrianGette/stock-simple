import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Stock y precios', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const http = () => request(app.getHttpServer())
  const adjust = (productId: string, body: object) =>
    http().post(`/api/products/${productId}/stock-adjustments`).set(auth(shop.tokens.MANAGER)).send(body)

  it('crea un producto con stock inicial y rechaza SKU duplicado', async () => {
    const body = { name: 'Tabla Ruido 8.0"', sku: 'tab-1', costCents: 5_800_000, priceCents: 8_990_000, initialStock: 12, categoryId: shop.categoryId }
    const res = await http().post('/api/products').set(auth(shop.tokens.OWNER)).send(body).expect(201)
    expect(res.body).toMatchObject({ sku: 'TAB-1', stock: 12, category: { name: 'General' } })
    expect(await prisma.stockMovement.count({ where: { productId: res.body.id, type: 'INITIAL' } })).toBe(1)

    const dup = await http().post('/api/products').set(auth(shop.tokens.OWNER)).send(body).expect(409)
    expect(dup.body.code).toBe('SKU_TAKEN')
  })

  it('busca por código exacto y valida el parámetro', async () => {
    const productId = await shop.product()
    const found = await http().get('/api/products/lookup').query({ code: ' sku-1 ' }).set(auth(shop.tokens.CASHIER)).expect(200)
    expect(found.body.id).toBe(productId)
    // Un parámetro repetido llega como lista: se rechaza en lugar de romper con un error 500.
    const repeated = await http().get('/api/products/lookup?code=SKU-1&code=SKU-2').set(auth(shop.tokens.CASHIER)).expect(400)
    expect(repeated.body.code).toBe('VALIDATION_FAILED')
  })

  it('el recuento calcula la diferencia contra el stock del sistema', async () => {
    const id = await shop.product({ stock: 10 })
    const res = await adjust(id, { type: 'COUNT', countedStock: 7, note: 'Inventario mensual' }).expect(201)
    expect(res.body).toMatchObject({ type: 'COUNT', quantity: -3, stockAfter: 7 })
  })

  it('el ingreso de mercadería puede actualizar el costo y queda en el historial', async () => {
    const id = await shop.product({ stock: 2, costCents: 50_000 })
    await adjust(id, { type: 'PURCHASE', quantity: 24, unitCostCents: 55_000 }).expect(201)
    const product = await prisma.product.findUniqueOrThrow({ where: { id } })
    expect(product).toMatchObject({ stock: 26, costCents: 55_000 })

    const history = await http().get(`/api/products/${id}/price-history`).set(auth(shop.tokens.OWNER)).expect(200)
    expect(history.body[0]).toMatchObject({ reason: 'PURCHASE', oldCostCents: 50_000, newCostCents: 55_000 })
  })

  it('no permite registrar pérdidas mayores al stock', async () => {
    const id = await shop.product({ stock: 2 })
    const res = await adjust(id, { type: 'LOSS', quantity: 5, note: 'Vencidos' }).expect(422)
    expect(res.body.code).toBe('INSUFFICIENT_STOCK')
  })

  it('la vista previa del aumento masivo coincide con lo que se aplica', async () => {
    const a = await shop.product({ priceCents: 123_400, costCents: 80_000 })
    const b = await shop.product({ priceCents: 99_000, costCents: 60_000 })
    const body = { categoryId: shop.categoryId, percent: 7, roundTo: 1000, direction: 'up', target: 'both' }

    const preview = await http().post('/api/prices/preview').set(auth(shop.tokens.MANAGER)).send(body).expect(200)
    expect(preview.body.count).toBe(2)
    const rowA = preview.body.rows.find((r: { productId: string }) => r.productId === a)
    expect(rowA).toMatchObject({ oldPriceCents: 123_400, newPriceCents: 133_000, newCostCents: 85_600 })

    const applied = await http().post('/api/prices/apply').set(auth(shop.tokens.MANAGER)).send(body).expect(200)
    expect(applied.body.updated).toBe(2)

    for (const row of preview.body.rows) {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: row.productId } })
      expect([product.priceCents, product.costCents]).toEqual([row.newPriceCents, row.newCostCents])
    }
    const changes = await prisma.priceChange.findMany({ where: { productId: { in: [a, b] } } })
    expect(new Set(changes.map((c) => c.batchId)).size).toBe(1)
  })
})
