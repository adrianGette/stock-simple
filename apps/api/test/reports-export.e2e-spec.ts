import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { CSV_BOM, type PaymentMethod, type ReportSection, addDays, toLocalIsoDate } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

/** Separa el CSV en encabezado y filas (los datos de estos tests no llevan `;` ni saltos de línea). */
function parse(text: string): { header: string[]; rows: string[][] } {
  const [header = '', ...rows] = text.replace(CSV_BOM, '').split('\r\n').filter(Boolean)
  return { header: header.split(';'), rows: rows.map((row) => row.split(';')) }
}

describe('Exportación de reportes a CSV', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const today = toLocalIsoDate(new Date())
  const range = { from: addDays(today, -2), to: today }

  const http = () => request(app.getHttpServer())
  const sell = (productId: string, quantity: number, paymentMethod: PaymentMethod = 'CASH') =>
    http()
      .post('/api/sales')
      .set(auth(shop.tokens.CASHIER))
      .send({ idempotencyKey: randomUUID(), paymentMethod, items: [{ productId, quantity }] })
      .expect(201)
  const exportSection = (section: ReportSection, token = shop.tokens.OWNER) =>
    http().get('/api/reports/sales/export').query({ ...range, section }).set(auth(token))

  it('descarga cada sección como un CSV aparte, con nombre por sección y período', async () => {
    await sell(await shop.product(), 1)

    const res = await exportSection('daily').expect(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toBe(`attachment; filename="ventas-por-dia_${range.from}_${range.to}.csv"`)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.text.startsWith(CSV_BOM)).toBe(true)
  })

  it('ventas por día incluye los días sin ventas en cero', async () => {
    await sell(await shop.product({ priceCents: 100_000, costCents: 60_000 }), 2)

    const { header, rows } = parse((await exportSection('daily').expect(200)).text)
    expect(header).toEqual(['Fecha', 'Ventas', 'Ganancia bruta', 'Tickets'])
    expect(rows).toEqual([
      [range.from, '0,00', '0,00', '0'],
      [addDays(today, -1), '0,00', '0,00', '0'],
      [today, '2000,00', '800,00', '1'],
    ])
  })

  it('productos vendidos trae todos, no solo el top 10 de la pantalla', async () => {
    for (let i = 0; i < 12; i++) await sell(await shop.product(), 1)

    const screen = await http().get('/api/reports/sales').query(range).set(auth(shop.tokens.OWNER)).expect(200)
    expect(screen.body.topProducts).toHaveLength(10)

    const { header, rows } = parse((await exportSection('products').expect(200)).text)
    expect(header).toEqual(['SKU', 'Producto', 'Unidades', 'Ventas', 'Ganancia bruta', 'Margen %'])
    expect(rows).toHaveLength(12)
    expect(rows[0]).toEqual([expect.stringMatching(/^SKU-/), expect.stringMatching(/^Producto /), '1', '1000,00', '400,00', '40'])
  })

  it('medios de pago usa los nombres en español y categorías incluye el margen', async () => {
    const product = await shop.product({ priceCents: 100_000, costCents: 75_000 })
    await sell(product, 1, 'DEBIT')
    await sell(product, 1, 'TRANSFER')

    const payments = parse((await exportSection('payments').expect(200)).text)
    expect(payments.rows.map((row) => row[0]).toSorted()).toEqual(['Débito', 'Transferencia'])

    const categories = parse((await exportSection('categories').expect(200)).text)
    expect(categories.rows).toEqual([['General', '2000,00', '500,00', '25']])
  })

  it('el cajero no puede exportar reportes, y se validan sección y período', async () => {
    expect((await exportSection('daily', shop.tokens.CASHIER)).status).toBe(403)
    const badSection = await http().get('/api/reports/sales/export').query({ ...range, section: 'todo' }).set(auth(shop.tokens.OWNER))
    expect(badSection.status).toBe(400)
    const badRange = await http()
      .get('/api/reports/sales/export')
      .query({ from: today, to: range.from, section: 'daily' })
      .set(auth(shop.tokens.OWNER))
    expect(badRange.status).toBe(400)
  })
})
