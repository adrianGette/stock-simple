import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { CSV_BOM } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

const HEADER = 'SKU;Código de barras;Nombre;Categoría;Costo;Precio;Stock;Stock mínimo;Activo'
const csv = (...lines: string[]) => `${CSV_BOM}${[HEADER, ...lines].join('\r\n')}\r\n`

describe('Actualización de productos desde CSV', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const send = (path: 'import/preview' | 'import', body: string) =>
    request(app.getHttpServer()).post(`/api/products/${path}`).set(auth(shop.tokens.OWNER)).set('Content-Type', 'text/csv').send(body)
  const product = (sku: string) => prisma.product.findFirstOrThrow({ where: { businessId: shop.businessId, sku }, include: { category: true } })

  /** Remera con categoría "General" (la del fixture), stock 10. */
  async function seedRemera(barcode: string | null = '7790000000017') {
    await prisma.product.create({
      data: {
        businessId: shop.businessId,
        sku: 'REM-01',
        barcode,
        name: 'Remera negra',
        categoryId: shop.categoryId,
        costCents: 2_000_000,
        priceCents: 3_990_000,
        stock: 10,
        minStock: 2,
      },
    })
  }

  it('la vista previa separa nuevos, actualizados y sin cambios, con el detalle de cada cambio', async () => {
    await seedRemera()
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: 'LIJ-01', name: 'Lija', categoryId: shop.categoryId, costCents: 400_000, priceCents: 950_000 },
    })

    const res = await send(
      'import/preview',
      csv(
        'REM-01;7790000000017;Remera negra;general;20000;42.900;10;3;Sí', // precio y stock mínimo; "general" es "General"
        'LIJ-01;;Lija;General;4000;9500;0;0;Sí', // idéntica
        'GOR-01;;Gorra;Gorras;5000;12000;4;;', // nueva
      ),
    ).expect(200)

    expect(res.body).toMatchObject({ rows: 3, toCreate: 1, toUpdate: 1, unchanged: 1, newCategories: ['Gorras'], errorCount: 0 })
    expect(res.body.updates).toEqual([
      {
        row: 2,
        sku: 'REM-01',
        name: 'Remera negra',
        changes: [
          { field: 'price', before: 3_990_000, after: 4_290_000 },
          { field: 'minStock', before: 2, after: 3 },
        ],
      },
    ])
  })

  it('actualiza, registra el cambio de precio, no toca el stock ni las filas idénticas', async () => {
    await seedRemera()
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: 'LIJ-01', name: 'Lija', costCents: 400_000, priceCents: 950_000, stock: 7 },
    })
    const lijaBefore = await product('LIJ-01')

    const res = await send(
      'import',
      csv(
        'REM-01;7790000000017;Remera negra lisa;Remeras;21000;42900;999;3;No', // el stock 999 se ignora
        'LIJ-01;;Lija;;4000;9500;0;0;Sí',
      ),
    ).expect(201)
    expect(res.body).toEqual({ created: 0, updated: 1, newCategories: ['Remeras'] })

    const remera = await product('REM-01')
    expect([remera.name, remera.category?.name, remera.costCents, remera.priceCents, remera.minStock, remera.active, remera.stock]).toEqual([
      'Remera negra lisa',
      'Remeras',
      2_100_000,
      4_290_000,
      3,
      false,
      10,
    ])
    const history = await prisma.priceChange.findMany({ where: { productId: remera.id } })
    expect(history).toMatchObject([
      { reason: 'BULK', oldPriceCents: 3_990_000, newPriceCents: 4_290_000, oldCostCents: 2_000_000, newCostCents: 2_100_000 },
    ])
    expect(history[0]?.batchId).toBeTruthy()

    // La fila idéntica no se guardó: misma fecha de actualización.
    expect((await product('LIJ-01')).updatedAt).toEqual(lijaBefore.updatedAt)
  })

  it('una celda vacía borra el código de barras y la categoría', async () => {
    await seedRemera()

    const preview = await send('import/preview', csv('REM-01;;Remera negra;;20000;39900;10;2;Sí')).expect(200)
    expect(preview.body.updates[0].changes).toEqual([
      { field: 'barcode', before: '7790000000017', after: null },
      { field: 'category', before: 'General', after: null },
    ])

    await send('import', csv('REM-01;;Remera negra;;20000;39900;10;2;Sí')).expect(201)
    const remera = await product('REM-01')
    expect([remera.barcode, remera.categoryId]).toEqual([null, null])
  })

  it('permite intercambiar códigos de barras entre productos del archivo', async () => {
    await seedRemera('7790000000017')
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: 'LIJ-01', barcode: '7790000000024', name: 'Lija', costCents: 1, priceCents: 2 },
    })

    await send('import', csv('REM-01;7790000000024;Remera negra;General;20000;39900;;2;', 'LIJ-01;7790000000017;Lija;;0,01;0,02;;;')).expect(201)
    expect((await product('REM-01')).barcode).toBe('7790000000024')
    expect((await product('LIJ-01')).barcode).toBe('7790000000017')
  })

  it('no deja usar el código de barras de un producto que no está en el archivo', async () => {
    await seedRemera('7790000000017')

    const res = await send('import/preview', csv('GOR-01;7790000000017;Gorra;;5000;12000;;;')).expect(200)
    expect(res.body.errors).toEqual([{ row: 2, message: 'Código de barras: ya lo usa el producto REM-01.' }])
  })

  it('exportar, cambiar un precio en la planilla y volver a subir actualiza solo ese producto', async () => {
    await seedRemera()
    await prisma.product.create({
      data: { businessId: shop.businessId, sku: 'LIJ-01', name: 'Lija', costCents: 400_000, priceCents: 950_000, stock: 7 },
    })
    const exported = (await request(app.getHttpServer()).get('/api/products/export').set(auth(shop.tokens.OWNER)).expect(200)).text

    const edited = exported.replace('Lija;;4000,00;9500,00', 'Lija;;4000,00;9900,00')
    const preview = await send('import/preview', edited).expect(200)
    expect(preview.body).toMatchObject({ toCreate: 0, toUpdate: 1, unchanged: 1, errorCount: 0 })
    expect(preview.body.updates[0]).toMatchObject({ sku: 'LIJ-01', changes: [{ field: 'price', before: 950_000, after: 990_000 }] })
  })
})
