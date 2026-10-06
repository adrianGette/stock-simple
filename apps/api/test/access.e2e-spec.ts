import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Permisos y aislamiento entre comercios', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture
  let other: Fixture

  beforeAll(async () => {
    ;({ app, prisma } = await createTestApp())
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma, 'Skate shop A')
    other = await createFixture(app, prisma, 'Skate shop B')
  })
  afterAll(() => app.close())

  const http = () => request(app.getHttpServer())

  it('el cajero no ve costos', async () => {
    await shop.product()
    const asCashier = await http().get('/api/products').set(auth(shop.tokens.CASHIER)).expect(200)
    const asOwner = await http().get('/api/products').set(auth(shop.tokens.OWNER)).expect(200)
    expect(asCashier.body.items[0]).not.toHaveProperty('costCents')
    expect(asOwner.body.items[0]).toHaveProperty('costCents', 60_000)
  })

  it.each([
    ['CASHIER', 'get', '/api/reports/dashboard'],
    ['CASHIER', 'post', '/api/prices/preview'],
    ['CASHIER', 'post', '/api/products'],
    ['MANAGER', 'get', '/api/users'],
  ] as const)('%s no puede %s %s', async (role, method, url) => {
    const res = await http()[method](url).set(auth(shop.tokens[role])).send({}).expect(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('un comercio no puede ver ni vender productos de otro', async () => {
    const foreign = await other.product()
    await http().get(`/api/products/${foreign}`).set(auth(shop.tokens.OWNER)).expect(404)

    const list = await http().get('/api/products?pageSize=100').set(auth(shop.tokens.OWNER)).expect(200)
    expect(list.body.items.map((p: { id: string }) => p.id)).not.toContain(foreign)

    await http()
      .post('/api/sales')
      .set(auth(shop.tokens.CASHIER))
      .send({ idempotencyKey: crypto.randomUUID(), paymentMethod: 'CASH', items: [{ productId: foreign, quantity: 1 }] })
      .expect(404)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: foreign } })).stock).toBe(10)
  })

  it('el cajero solo ve sus propias ventas', async () => {
    const productId = await shop.product()
    const sell = (token: string) =>
      http()
        .post('/api/sales')
        .set(auth(token))
        .send({ idempotencyKey: crypto.randomUUID(), paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] })
        .expect(201)
    await sell(shop.tokens.CASHIER)
    const managerSale = await sell(shop.tokens.MANAGER)

    const cashierList = await http().get('/api/sales').set(auth(shop.tokens.CASHIER)).expect(200)
    expect(cashierList.body.items).toHaveLength(1)
    await http().get(`/api/sales/${managerSale.body.id}`).set(auth(shop.tokens.CASHIER)).expect(404)

    const ownerList = await http().get('/api/sales').set(auth(shop.tokens.OWNER)).expect(200)
    expect(ownerList.body.items).toHaveLength(2)
  })

  it('el dueño no puede quitarse su propio rol', async () => {
    const res = await http()
      .patch(`/api/users/${shop.userIds.OWNER}`)
      .set(auth(shop.tokens.OWNER))
      .send({ role: 'CASHIER' })
      .expect(422)
    expect(res.body.code).toBe('CANNOT_MODIFY_SELF')
  })

  it('valida los datos con mensajes en español', async () => {
    const res = await http().post('/api/products').set(auth(shop.tokens.OWNER)).send({ name: 'X', sku: 'a b' }).expect(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
    expect(res.body.details).toEqual(expect.arrayContaining([{ path: 'name', message: 'Mínimo 2 caracteres' }]))
  })
})
