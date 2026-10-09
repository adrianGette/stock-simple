import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { CSV_BOM } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

/** Completa la columna "Contado" de una planilla descargada: { SKU: cantidad }. */
function fillCount(sheet: string, counts: Record<string, number>): string {
  return sheet
    .split('\r\n')
    .map((line) => {
      const sku = line.replace(CSV_BOM, '').split(';')[0] ?? ''
      return sku in counts ? line.replace(/;$/, `;${counts[sku]}`) : line
    })
    .join('\r\n')
}

describe('Conteo de inventario por planilla', () => {
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
  const downloadSheet = async (query: Record<string, string> = {}) =>
    (await http().get('/api/products/count-sheet').query(query).set(auth(shop.tokens.OWNER)).expect(200)).text
  const send = (path: 'count/preview' | 'count', body: string, token = shop.tokens.OWNER) =>
    http().post(`/api/products/${path}`).set(auth(token)).set('Content-Type', 'text/csv').send(body)
  const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock

  it('la planilla trae el stock del sistema y la columna "Contado" vacía, con los filtros de la lista', async () => {
    await shop.product({ stock: 10, minStock: 2 }) // Producto 1
    await shop.product({ stock: 1, minStock: 5 }) // Producto 2: stock bajo

    const res = await http().get('/api/products/count-sheet').query({ stock: 'low' }).set(auth(shop.tokens.OWNER)).expect(200)
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="conteo-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(res.text).toBe(`${CSV_BOM}SKU;Nombre;Categoría;Stock del sistema;Contado\r\nSKU-2;Producto 2;General;1;\r\n`)
  })

  it('la vista previa muestra diferencias, coincidencias y filas sin contar, y no guarda nada', async () => {
    const a = await shop.product({ stock: 10 })
    await shop.product({ stock: 5 })
    await shop.product({ stock: 3 })

    const sheet = fillCount(await downloadSheet(), { 'SKU-1': 8, 'SKU-2': 5 }) // SKU-3 sin contar
    const res = await send('count/preview', sheet).expect(200)

    expect(res.body).toMatchObject({ rows: 3, toAdjust: 1, matching: 1, skipped: 1, movedSince: 0, errorCount: 0 })
    expect(res.body.lines).toEqual([
      { row: 2, sku: 'SKU-1', name: 'Producto 1', systemStock: 10, currentStock: 10, counted: 8, difference: -2, stockAfter: 8 },
    ])
    expect(await stockOf(a)).toBe(10)
  })

  it('al confirmar, el stock queda en lo contado y la diferencia queda como movimiento de conteo', async () => {
    const a = await shop.product({ stock: 10 })
    const b = await shop.product({ stock: 5 })

    const res = await send('count', fillCount(await downloadSheet(), { 'SKU-1': 8, 'SKU-2': 7 })).expect(201)
    expect(res.body).toEqual({ adjusted: 2 })

    expect([await stockOf(a), await stockOf(b)]).toEqual([8, 7])
    const movements = await prisma.stockMovement.findMany({ where: { productId: { in: [a, b] } }, orderBy: { quantity: 'asc' } })
    expect(movements.map((m) => [m.type, m.quantity, m.stockAfter])).toEqual([
      ['COUNT', -2, 8],
      ['COUNT', 2, 7],
    ])
    expect(movements[0]?.note).toBe('Conteo por planilla: había 10, se contaron 8')
  })

  it('si hubo una venta mientras se contaba, la avisa y no la descuenta dos veces', async () => {
    const remera = await shop.product({ stock: 10 })
    const sheet = fillCount(await downloadSheet(), { 'SKU-1': 8 }) // faltan 2 respecto de la planilla

    // Mientras se cuenta, se vende 1.
    await http()
      .post('/api/sales')
      .set(auth(shop.tokens.CASHIER))
      .send({ idempotencyKey: randomUUID(), paymentMethod: 'CASH', items: [{ productId: remera, quantity: 1 }] })
      .expect(201)

    const preview = await send('count/preview', sheet).expect(200)
    expect(preview.body.movedSince).toBe(1)
    expect(preview.body.lines[0]).toMatchObject({ systemStock: 10, currentStock: 9, counted: 8, difference: -2, stockAfter: 7 })

    await send('count', sheet).expect(201)
    expect(await stockOf(remera)).toBe(7)
  })

  it('informa SKU inexistentes y conteos que dejarían el stock negativo, y no ajusta nada', async () => {
    const a = await shop.product({ stock: 2 })
    // La planilla dice que había 10 (por ejemplo, de otro día): contar 0 dejaría el stock en -8.
    const sheet = `${CSV_BOM}SKU;Nombre;Categoría;Stock del sistema;Contado\r\nSKU-1;;;10;0\r\nNOEXISTE;;;1;1\r\n`

    const res = await send('count', sheet).expect(422)
    expect(res.body.details.errors).toEqual([
      { row: 2, message: 'Contado: con los movimientos posteriores a la planilla el stock quedaría en -8. Volvé a contar este producto.' },
      { row: 3, message: 'SKU: no existe un producto con el SKU NOEXISTE.' },
    ])
    expect(await stockOf(a)).toBe(2)
  })

  it('solo dueño/a y encargado/a pueden contar', async () => {
    await shop.product({ stock: 1 })
    expect((await http().get('/api/products/count-sheet').set(auth(shop.tokens.CASHIER))).status).toBe(403)
    expect((await send('count', fillCount(await downloadSheet(), { 'SKU-1': 0 }), shop.tokens.CASHIER)).status).toBe(403)
    expect((await send('count/preview', fillCount(await downloadSheet(), { 'SKU-1': 0 }), shop.tokens.MANAGER)).status).toBe(200)
  })
})
