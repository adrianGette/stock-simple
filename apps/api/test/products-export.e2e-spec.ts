import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { CSV_BOM } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

describe('Exportación de productos a CSV', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const exportAs = (token: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get('/api/products/export').query(query).set(auth(token))

  /** Separa el CSV en encabezado y filas (los datos de estos tests no llevan `;` ni saltos de línea). */
  function parse(text: string): { header: string[]; rows: string[][] } {
    const [header = '', ...rows] = text.replace(CSV_BOM, '').split('\r\n').filter(Boolean)
    return { header: header.split(';'), rows: rows.map((row) => row.split(';')) }
  }

  it('descarga un CSV compatible con Excel en español', async () => {
    await shop.product({ priceCents: 125_050, costCents: 60_000, stock: 7, minStock: 2 })

    const res = await exportAs(shop.tokens.OWNER).expect(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="productos-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.text.startsWith(CSV_BOM)).toBe(true)

    const { header, rows } = parse(res.text)
    expect(header).toEqual(['SKU', 'Código de barras', 'Nombre', 'Categoría', 'Costo', 'Precio', 'Stock', 'Stock mínimo', 'Activo'])
    expect(rows).toEqual([['SKU-1', '', 'Producto 1', 'General', '600,00', '1250,50', '7', '2', 'Sí']])
  })

  it('trae todos los productos una sola vez, aunque sean varios lotes y tengan el mismo nombre', async () => {
    // 1.203 productos = 2 lotes completos de 500 + uno parcial. Mismo nombre para que el corte
    // entre lotes dependa solo del desempate por id.
    await prisma.product.createMany({
      data: Array.from({ length: 1203 }, (_, i) => ({
        businessId: shop.businessId,
        sku: `TIE-${i}`,
        name: 'Rulemanes ABEC 7',
        costCents: 60_000,
        priceCents: 100_000,
      })),
    })

    const { rows } = parse((await exportAs(shop.tokens.OWNER).expect(200)).text)
    const skus = rows.map((row) => row[0])
    expect(skus).toHaveLength(1203)
    expect(new Set(skus).size).toBe(1203)
  })

  it('al cajero no le envía la columna de costo', async () => {
    await shop.product({ costCents: 60_000, priceCents: 100_000 })

    const { header, rows } = parse((await exportAs(shop.tokens.CASHIER).expect(200)).text)
    expect(header).not.toContain('Costo')
    expect(rows[0]).not.toContain('600,00')
    expect(rows[0]?.[header.indexOf('Precio')]).toBe('1000,00')
  })

  it('respeta los mismos filtros que la lista', async () => {
    await shop.product({ stock: 1, minStock: 5 }) // Producto 1: stock bajo
    await shop.product({ stock: 50, minStock: 5 }) // Producto 2

    const low = parse((await exportAs(shop.tokens.OWNER, { stock: 'low' }).expect(200)).text)
    expect(low.rows.map((row) => row[2])).toEqual(['Producto 1'])

    const search = parse((await exportAs(shop.tokens.OWNER, { q: 'producto 2' }).expect(200)).text)
    expect(search.rows.map((row) => row[2])).toEqual(['Producto 2'])
  })

  it('no incluye productos de otro comercio', async () => {
    await shop.product()
    const other = await createFixture(app, prisma, 'Otro comercio')
    await other.product()

    const { rows } = parse((await exportAs(shop.tokens.OWNER).expect(200)).text)
    expect(rows).toHaveLength(1)
  })

  it('neutraliza nombres que la planilla ejecutaría como fórmula', async () => {
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: 'EVIL-1', name: '=1+1', costCents: 0, priceCents: 0 },
    })

    const { rows } = parse((await exportAs(shop.tokens.OWNER).expect(200)).text)
    expect(rows[0]?.[2]).toBe("'=1+1")
  })

  it('rechaza filtros inválidos y pedidos sin sesión', async () => {
    await exportAs(shop.tokens.OWNER, { stock: 'cualquiera' }).expect(400)
    await request(app.getHttpServer()).get('/api/products/export').expect(401)
  })
})
