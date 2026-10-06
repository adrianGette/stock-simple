import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Ventas', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const sell = (items: { productId: string; quantity: number }[], idempotencyKey: string = crypto.randomUUID()) =>
    request(app.getHttpServer()).post('/api/sales').set(auth(shop.tokens.CASHIER)).send({ idempotencyKey, paymentMethod: 'DEBIT', items })
  const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock

  it('registra la venta, descuenta stock y deja el movimiento en el libro', async () => {
    const a = await shop.product({ stock: 10, priceCents: 150_000 })
    const b = await shop.product({ stock: 5, priceCents: 20_000 })

    const res = await sell([{ productId: a, quantity: 2 }, { productId: b, quantity: 3 }]).expect(201)

    expect(res.body).toMatchObject({ number: 1, status: 'COMPLETED', totalCents: 360_000, itemCount: 2 })
    expect(res.body).not.toHaveProperty('costCents') // la cajera no ve el costo
    expect(await stockOf(a)).toBe(8)
    expect(await stockOf(b)).toBe(2)
    const movements = await prisma.stockMovement.findMany({ where: { saleId: res.body.id }, orderBy: { quantity: 'asc' } })
    expect(movements.map((m) => [m.type, m.quantity, m.stockAfter])).toEqual([
      ['SALE', -3, 2],
      ['SALE', -2, 8],
    ])
  })

  it('es atómica: si un producto no alcanza, no se descuenta ninguno', async () => {
    const a = await shop.product({ stock: 10 })
    const b = await shop.product({ stock: 1 })

    const res = await sell([{ productId: a, quantity: 2 }, { productId: b, quantity: 5 }]).expect(422)

    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { productId: b, requested: 5, available: 1 } })
    expect(await stockOf(a)).toBe(10)
    expect(await stockOf(b)).toBe(1)
    expect(await prisma.sale.count()).toBe(0)
  })

  it('es idempotente: reintentar con la misma clave no duplica la venta', async () => {
    const a = await shop.product({ stock: 10 })
    const key = crypto.randomUUID()

    const [first, second] = await Promise.all([sell([{ productId: a, quantity: 1 }], key), sell([{ productId: a, quantity: 1 }], key)])

    expect(first.body.id).toBe(second.body.id)
    expect(await prisma.sale.count()).toBe(1)
    expect(await stockOf(a)).toBe(9)
  })

  it('nunca vende de más con cajas concurrentes', async () => {
    const a = await shop.product({ stock: 5 })

    const results = await Promise.all(Array.from({ length: 12 }, () => sell([{ productId: a, quantity: 1 }])))

    expect(results.filter((r) => r.status === 201)).toHaveLength(5)
    expect(results.filter((r) => r.status === 422)).toHaveLength(7)
    expect(await stockOf(a)).toBe(0)
    // Los números de venta son correlativos y sin huecos.
    const numbers = (await prisma.sale.findMany({ orderBy: { number: 'asc' } })).map((s) => s.number)
    expect(numbers).toEqual([1, 2, 3, 4, 5])
  })

  it('anular devuelve el stock y no se puede anular dos veces', async () => {
    const a = await shop.product({ stock: 4 })
    const sale = await sell([{ productId: a, quantity: 3 }]).expect(201)
    const voidSale = () =>
      request(app.getHttpServer())
        .post(`/api/sales/${sale.body.id}/void`)
        .set(auth(shop.tokens.MANAGER))
        .send({ reason: 'Cobro duplicado' })

    const res = await voidSale().expect(200)
    expect(res.body).toMatchObject({ status: 'VOIDED', voidReason: 'Cobro duplicado', voidedBy: { id: shop.userIds.MANAGER } })
    expect(await stockOf(a)).toBe(4)
    expect((await voidSale().expect(409)).body.code).toBe('SALE_ALREADY_VOIDED')
    expect(await stockOf(a)).toBe(4)
  })

  it('guarda el precio del momento: cambiarlo después no altera la venta', async () => {
    const a = await shop.product({ stock: 5, priceCents: 100_000 })
    const sale = await sell([{ productId: a, quantity: 1 }]).expect(201)
    await prisma.product.update({ where: { id: a }, data: { priceCents: 999_900 } })

    const res = await request(app.getHttpServer()).get(`/api/sales/${sale.body.id}`).set(auth(shop.tokens.OWNER)).expect(200)
    expect(res.body.totalCents).toBe(100_000)
    expect(res.body.items[0]).toMatchObject({ unitPriceCents: 100_000, unitCostCents: 60_000 })
  })
})
