import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Orden del listado de productos', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const list = (query: Record<string, string>, token = shop.tokens.OWNER) =>
    request(app.getHttpServer()).get('/api/products').query(query).set(auth(token))
  const names = async (query: Record<string, string>) =>
    ((await list(query).expect(200)).body.items as { name: string }[]).map((p) => p.name)

  async function createProduct(name: string, priceCents: number, costCents: number, extra: { stock?: number; categoryId?: string } = {}) {
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: name.toUpperCase().replaceAll(' ', '-'), name, priceCents, costCents, ...extra },
    })
  }

  it('ordena por precio en las dos direcciones', async () => {
    await createProduct('Medias', 5_000, 2_000)
    await createProduct('Tabla', 90_000, 60_000)
    await createProduct('Lija', 9_000, 4_000)

    expect(await names({ sort: 'price', dir: 'asc' })).toEqual(['Medias', 'Lija', 'Tabla'])
    expect(await names({ sort: 'price', dir: 'desc' })).toEqual(['Tabla', 'Lija', 'Medias'])
  })

  it('ordena por margen calculado en la base, con los productos sin precio al final', async () => {
    await createProduct('Margen 50', 10_000, 5_000)
    await createProduct('Margen 10', 10_000, 9_000)
    await createProduct('Margen negativo', 10_000, 12_000)
    await createProduct('Sin precio', 0, 1_000)

    expect(await names({ sort: 'margin', dir: 'asc' })).toEqual(['Margen negativo', 'Margen 10', 'Margen 50', 'Sin precio'])
    expect(await names({ sort: 'margin', dir: 'desc' })).toEqual(['Margen 50', 'Margen 10', 'Margen negativo', 'Sin precio'])
  })

  it('el margen se recalcula solo cuando cambia el precio', async () => {
    await createProduct('A', 10_000, 5_000) // 50 %
    await createProduct('B', 10_000, 8_000) // 20 %
    const b = await prisma.product.findFirstOrThrow({ where: { name: 'B' } })

    await request(app.getHttpServer()).patch(`/api/products/${b.id}`).set(auth(shop.tokens.OWNER)).send({ priceCents: 40_000 }).expect(200)

    expect(await names({ sort: 'margin', dir: 'desc' })).toEqual(['B', 'A']) // B ahora deja 80 %
  })

  it('ordena por stock y por categoría, desempatando por nombre', async () => {
    const remeras = await prisma.category.create({ data: { businessId: shop.businessId, name: 'Remeras' } })
    await createProduct('Zeta', 1_000, 500, { stock: 3, categoryId: remeras.id })
    await createProduct('Alfa', 1_000, 500, { stock: 3, categoryId: shop.categoryId }) // "General"
    await createProduct('Beta', 1_000, 500, { stock: 1, categoryId: remeras.id })

    expect(await names({ sort: 'stock', dir: 'asc' })).toEqual(['Beta', 'Alfa', 'Zeta'])
    expect(await names({ sort: 'category', dir: 'asc' })).toEqual(['Alfa', 'Beta', 'Zeta'])
    expect(await names({ sort: 'category', dir: 'desc' })).toEqual(['Beta', 'Zeta', 'Alfa'])
  })

  it('el cajero puede ordenar por precio pero no por margen', async () => {
    await createProduct('Medias', 5_000, 2_000)

    expect((await list({ sort: 'price' }, shop.tokens.CASHIER)).status).toBe(200)
    const res = await list({ sort: 'margin' }, shop.tokens.CASHIER)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('rechaza columnas o direcciones desconocidas', async () => {
    expect((await list({ sort: 'cost' })).status).toBe(400)
    expect((await list({ sort: 'price', dir: 'up' })).status).toBe(400)
  })
})
