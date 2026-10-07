import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { PRODUCT_SORTS } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

// Regresión: con empates en la columna de orden, Postgres puede desempatar distinto en cada página
// (LIMIT 20 vs OFFSET 20 LIMIT 20) y la paginación por offset repite o saltea filas.
describe('Paginación estable con empates', () => {
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
  const sameInstant = new Date('2026-01-01T12:00:00Z')

  /** Recorre todas las páginas y devuelve los ids en el orden recibido. */
  async function collectIds(url: string, query: Record<string, string | number> = {}): Promise<{ ids: string[]; total: number }> {
    const ids: string[] = []
    let total = 0
    for (let page = 1; page === 1 || ids.length < total; page++) {
      const res = await http().get(url).query({ ...query, page }).set(auth(shop.tokens.OWNER)).expect(200)
      total = res.body.total
      if (res.body.items.length === 0) break
      ids.push(...res.body.items.map((item: { id: string }) => item.id))
    }
    return { ids, total }
  }

  it.each(PRODUCT_SORTS)('el listado de productos ordenado por "%s" devuelve cada producto una sola vez', async (sort) => {
    // Todos iguales en nombre, stock, precio y fecha: el orden depende solo del desempate.
    await prisma.product.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({
        businessId: shop.businessId,
        sku: `TIE-${i}`,
        name: 'Rulemanes ABEC 7',
        costCents: 60_000,
        priceCents: 100_000,
        stock: 5,
        updatedAt: sameInstant,
      })),
    })

    const { ids, total } = await collectIds('/api/products', { sort, pageSize: 20 })
    expect(total).toBe(150)
    expect(ids).toHaveLength(150)
    expect(new Set(ids).size).toBe(150)
  })

  it('el historial de movimientos devuelve cada movimiento una sola vez', async () => {
    const productId = await shop.product()
    await prisma.stockMovement.createMany({
      data: Array.from({ length: 70 }, () => ({
        businessId: shop.businessId,
        productId,
        userId: shop.userIds.OWNER,
        type: 'COUNT' as const,
        quantity: 1,
        stockAfter: 10,
        createdAt: sameInstant,
      })),
    })

    const { ids, total } = await collectIds(`/api/products/${productId}/movements`)
    expect(total).toBe(70)
    expect(ids).toHaveLength(70)
    expect(new Set(ids).size).toBe(70)
  })
})
