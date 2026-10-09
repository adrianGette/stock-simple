import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { CSV_BOM, PRODUCT_IMPORT_MAX_BYTES } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

const HEADER = 'SKU;Código de barras;Nombre;Categoría;Costo;Precio;Stock;Stock mínimo;Activo'
const csv = (...lines: string[]) => `${CSV_BOM}${[HEADER, ...lines].join('\r\n')}\r\n`

describe('Importación de productos desde CSV', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())
  beforeEach(async () => {
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })

  const send = (path: 'import/preview' | 'import', body: string | Buffer, token = shop.tokens.OWNER) =>
    request(app.getHttpServer()).post(`/api/products/${path}`).set(auth(token)).set('Content-Type', 'text/csv').send(body)
  const productCount = () => prisma.product.count({ where: { businessId: shop.businessId } })

  const VALID = csv(
    'REM-01;7790001234567;Remera negra;Remeras;20000;39.900,00;5;2;Sí',
    'REM-02;;Remera blanca;remeras;20000;39900;0;2;',
    'LIJ-01;;Lija grip;general;4000;9500;10;;',
  )

  it('la vista previa cuenta lo que se crearía y no guarda nada', async () => {
    const res = await send('import/preview', VALID).expect(200)

    // "remeras" y "Remeras" son la misma categoría nueva; "general" ya existe como "General".
    expect(res.body).toEqual({
      rows: 3,
      toCreate: 3,
      toUpdate: 0,
      unchanged: 0,
      newCategories: ['Remeras'],
      updates: [],
      errors: [],
      errorCount: 0,
    })
    expect(await productCount()).toBe(0)
    expect(await prisma.category.count({ where: { businessId: shop.businessId } })).toBe(1)
  })

  it('importa los productos con sus categorías y registra el stock inicial en el libro', async () => {
    const res = await send('import', VALID).expect(201)
    expect(res.body).toEqual({ created: 3, updated: 0, newCategories: ['Remeras'] })

    const products = await prisma.product.findMany({
      where: { businessId: shop.businessId },
      include: { category: true, stockMovements: true },
      orderBy: { sku: 'asc' },
    })
    expect(products.map((p) => [p.sku, p.category?.name, p.priceCents, p.stock])).toEqual([
      ['LIJ-01', 'General', 950_000, 10],
      ['REM-01', 'Remeras', 3_990_000, 5],
      ['REM-02', 'Remeras', 3_990_000, 0],
    ])
    expect(products.map((p) => p.stockMovements.map((m) => [m.type, m.quantity]))).toEqual([[['INITIAL', 10]], [['INITIAL', 5]], []])
  })

  it('si una fila tiene errores no se guarda nada, ni lo que estaba bien', async () => {
    const withError = csv('REM-01;;Remera negra;Remeras;20000;39900;5;2;', 'REM-02;;Remera blanca;Remeras;20000;abc;;;')

    const res = await send('import', withError).expect(422)
    expect(res.body.code).toBe('IMPORT_INVALID')
    expect(res.body.details.errors).toEqual([{ row: 3, message: 'Precio: «abc» no es un monto válido.' }])
    expect(await productCount()).toBe(0)
    expect(await prisma.category.count({ where: { businessId: shop.businessId, name: 'Remeras' } })).toBe(0)
  })

  it('lo exportado de un comercio se puede importar en otro tal cual', async () => {
    await send('import', VALID).expect(201)
    const exported = await request(app.getHttpServer()).get('/api/products/export').set(auth(shop.tokens.OWNER)).expect(200)

    const other = await createFixture(app, prisma, 'Otro comercio')
    const res = await send('import', exported.text, other.tokens.OWNER).expect(201)
    expect(res.body.created).toBe(3)
    const copied = await prisma.product.findMany({ where: { businessId: other.businessId }, orderBy: { sku: 'asc' } })
    expect(copied.map((p) => [p.sku, p.name, p.costCents, p.priceCents, p.stock, p.minStock])).toEqual([
      ['LIJ-01', 'Lija grip', 400_000, 950_000, 10, 0],
      ['REM-01', 'Remera negra', 2_000_000, 3_990_000, 5, 2],
      ['REM-02', 'Remera blanca', 2_000_000, 3_990_000, 0, 2],
    ])
  })

  it('lee archivos guardados por Excel en Windows (sin UTF-8)', async () => {
    // "Categoría" y "Señal" en Windows-1252: í = 0xED, ñ = 0xF1.
    const latin1 = Buffer.from(`${HEADER}\r\nSEN-01;;Señal;;100;200;;;\r\n`, 'latin1')
    await send('import', latin1).expect(201)
    expect((await prisma.product.findFirstOrThrow({ where: { businessId: shop.businessId } })).name).toBe('Señal')
  })

  it('solo dueño/a y encargado/a pueden importar', async () => {
    expect((await send('import/preview', VALID, shop.tokens.MANAGER)).status).toBe(200)
    expect((await send('import', VALID, shop.tokens.CASHIER)).status).toBe(403)
    expect(await productCount()).toBe(0)
  })

  it('rechaza pedidos que no son CSV y archivos de más de 2 MB', async () => {
    const json = await request(app.getHttpServer()).post('/api/products/import').set(auth(shop.tokens.OWNER)).send({ rows: [] })
    expect(json.status).toBe(415)

    const huge = await send('import/preview', 'x'.repeat(PRODUCT_IMPORT_MAX_BYTES + 1))
    expect(huge.status).toBe(413)
    expect(huge.body.code).toBe('FILE_TOO_LARGE')
  })
})
