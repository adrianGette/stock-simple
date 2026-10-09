import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { type PaymentMethod, type Role, SALE_SORTS, SORT_DIRECTIONS } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Orden y filtros del listado de ventas', () => {
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

  /** Vende `lines` productos distintos de $1.000 c/u (una unidad de cada uno). Devuelve el número de venta. */
  async function sell(lines: number, { by = 'CASHIER', paymentMethod = 'CASH' }: { by?: Role; paymentMethod?: PaymentMethod } = {}) {
    const items = []
    for (let i = 0; i < lines; i++) items.push({ productId: await shop.product({ priceCents: 100_000, stock: 50 }), quantity: 1 })
    const res = await http().post('/api/sales').set(auth(shop.tokens[by])).send({ idempotencyKey: randomUUID(), paymentMethod, items }).expect(201)
    return res.body.number as number
  }

  const numbers = async (query: Record<string, string | number>) =>
    ((await http().get('/api/sales').query(query).set(auth(shop.tokens.OWNER)).expect(200)).body.items as { number: number }[]).map(
      (sale) => sale.number,
    )

  it('por defecto muestra primero las más recientes', async () => {
    const first = await sell(1)
    const second = await sell(1)
    expect(await numbers({})).toEqual([second, first])
  })

  it('ordena por total y por cantidad de productos, desempatando por número', async () => {
    const small = await sell(1)
    const big = await sell(3)
    const medium = await sell(2)

    expect(await numbers({ sort: 'total', dir: 'desc' })).toEqual([big, medium, small])
    expect(await numbers({ sort: 'items', dir: 'asc' })).toEqual([small, medium, big])
  })

  it('ordena por quién vendió', async () => {
    // Los usuarios del fixture se llaman "CASHIER test", "MANAGER test" y "OWNER test".
    const byOwner = await sell(1, { by: 'OWNER' })
    const byCashier = await sell(1, { by: 'CASHIER' })
    const byManager = await sell(1, { by: 'MANAGER' })

    expect(await numbers({ sort: 'seller', dir: 'asc' })).toEqual([byCashier, byManager, byOwner])
  })

  it('filtra por medio de pago', async () => {
    await sell(1, { paymentMethod: 'CASH' })
    const debit = await sell(1, { paymentMethod: 'DEBIT' })

    expect(await numbers({ paymentMethod: 'DEBIT' })).toEqual([debit])
    expect((await http().get('/api/sales').query({ paymentMethod: 'CHEQUE' }).set(auth(shop.tokens.OWNER))).status).toBe(400)
  })

  const sortCases = SALE_SORTS.flatMap((sort) => SORT_DIRECTIONS.map((dir) => [sort, dir] as const))

  it.each(sortCases)('paginando por "%s" (%s) cada venta aparece una sola vez', async (sort, dir) => {
    // 45 ventas iguales en total, productos y vendedor: el orden entre páginas depende del desempate.
    for (let i = 0; i < 45; i++) await sell(1)

    const seen: number[] = []
    for (let page = 1; page <= 3; page++) seen.push(...(await numbers({ sort, dir, page, pageSize: 20 })))
    expect(seen).toHaveLength(45)
    expect(new Set(seen).size).toBe(45)
  })
})
