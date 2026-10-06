/**
 * Datos de demostración: una skate shop de barrio (ropa, tablas y repuestos) con ~50
 * productos —la ropa con un SKU por talle— y 45 días de ventas.
 * Es determinístico (PRNG con semilla) para que la demo se vea siempre igual.
 *
 * ⚠️ Borra todos los datos de la base configurada en DATABASE_URL antes de cargar.
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { addDays, adjustAmount, toLocalIsoDate } from '@stock/shared'
import * as argon2 from 'argon2'
import { startOfLocalDay } from '../src/common/dates'
import { type PaymentMethod, PrismaClient, type Role } from '../src/generated/prisma/client'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const TZ = 'America/Argentina/Buenos_Aires'
const DAYS = 45
const BULK_INCREASE_DAYS_AGO = 18
const BULK_PERCENT = 8
const BUSINESS_NAME = 'Shop'
const DEMO_PASSWORD = 'demo1234'

// mulberry32: PRNG chico y determinístico
let seed = 20261005
function random(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const randomInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min
function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0)
  let r = random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]!
}

/** EAN-13 con prefijo argentino (779) y dígito verificador válido. */
function ean13(n: number): string {
  const base = `779${String(1_000_000_000 + n * 7919).slice(-9)}`
  const sum = [...base].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0)
  return base + ((10 - (sum % 10)) % 10)
}

const USERS: { name: string; email: string; role: Role }[] = [
  { name: 'Laura Méndez', email: 'duena@stocksimple.demo', role: 'OWNER' },
  { name: 'Martín Ríos', email: 'encargado@stocksimple.demo', role: 'MANAGER' },
  { name: 'Sofía Paz', email: 'cajera@stocksimple.demo', role: 'CASHIER' },
  { name: 'Diego Ruiz', email: 'cajero@stocksimple.demo', role: 'CASHIER' },
]

type CatalogItem = {
  name: string
  pesos: number
  /** Popularidad relativa: cuánto aparece en las ventas generadas. */
  weight: number
  minStock: number
  /** Si se vende por talle, se crea un producto (SKU) por talle. */
  sizes?: string[]
}

const TOPS = ['S', 'M', 'L', 'XL']
const PANTS = ['30', '32', '34']
const SHOES = ['40', '41', '42', '43']

const CATALOG: Record<string, { prefix: string; margin: [number, number]; items: CatalogItem[] }> = {
  Remeras: {
    prefix: 'REM',
    margin: [0.48, 0.56],
    items: [
      { name: 'Remera Ruido Logo negra', pesos: 34900, weight: 6, minStock: 3, sizes: TOPS },
      { name: 'Remera Ruido Logo blanca', pesos: 34900, weight: 4, minStock: 2, sizes: TOPS },
      { name: 'Remera Box Flame', pesos: 39900, weight: 3, minStock: 2, sizes: ['S', 'M', 'L'] },
    ],
  },
  Buzos: {
    prefix: 'BUZ',
    margin: [0.5, 0.58],
    items: [
      { name: 'Buzo canguro Ruido negro', pesos: 79900, weight: 3, minStock: 2, sizes: ['M', 'L', 'XL'] },
      { name: 'Buzo crew Skate or Die', pesos: 72900, weight: 2, minStock: 2, sizes: ['M', 'L'] },
    ],
  },
  Pantalones: {
    prefix: 'PAN',
    margin: [0.5, 0.58],
    items: [
      { name: 'Pantalón cargo baggy negro', pesos: 89900, weight: 2, minStock: 2, sizes: PANTS },
      { name: 'Jean baggy azul gastado', pesos: 94900, weight: 1.5, minStock: 2, sizes: PANTS },
    ],
  },
  Zapatillas: {
    prefix: 'ZAP',
    margin: [0.6, 0.68],
    items: [
      { name: 'Zapatillas suede negras', pesos: 149900, weight: 1.5, minStock: 1, sizes: SHOES },
      { name: 'Zapatillas lona caña alta', pesos: 119900, weight: 1.2, minStock: 1, sizes: ['40', '41', '42'] },
    ],
  },
  Gorras: {
    prefix: 'GOR',
    margin: [0.45, 0.55],
    items: [
      { name: 'Gorra 5 paneles Ruido', pesos: 32900, weight: 3, minStock: 4 },
      { name: 'Gorro beanie negro', pesos: 24900, weight: 3, minStock: 4 },
      { name: 'Bucket hat camo', pesos: 29900, weight: 1.5, minStock: 3 },
    ],
  },
  Tablas: {
    prefix: 'TAB',
    margin: [0.62, 0.7],
    items: [
      { name: 'Tabla Ruido 8.0"', pesos: 89900, weight: 6, minStock: 5 },
      { name: 'Tabla Ruido 8.25"', pesos: 89900, weight: 5, minStock: 5 },
      { name: 'Tabla Pro Model Calavera 8.5"', pesos: 109900, weight: 2, minStock: 2 },
      { name: 'Skate completo principiante 7.75"', pesos: 189900, weight: 1, minStock: 2 },
    ],
  },
  Ruedas: {
    prefix: 'RUE',
    margin: [0.62, 0.7],
    items: [
      { name: 'Ruedas 52 mm 99A (x4)', pesos: 59900, weight: 3, minStock: 3 },
      { name: 'Ruedas 54 mm 101A (x4)', pesos: 64900, weight: 2, minStock: 3 },
      { name: 'Ruedas cruiser 56 mm 78A (x4)', pesos: 69900, weight: 1, minStock: 2 },
    ],
  },
  Trucks: {
    prefix: 'TRU',
    margin: [0.65, 0.72],
    items: [
      { name: 'Trucks 139 mm (par)', pesos: 109900, weight: 1.5, minStock: 2 },
      { name: 'Trucks 149 mm (par)', pesos: 114900, weight: 1.2, minStock: 2 },
    ],
  },
  Rulemanes: {
    prefix: 'RUL',
    margin: [0.55, 0.65],
    items: [
      { name: 'Rulemanes ABEC 7', pesos: 29900, weight: 3, minStock: 4 },
      { name: 'Rulemanes cerámicos', pesos: 69900, weight: 1, minStock: 2 },
    ],
  },
  Accesorios: {
    prefix: 'ACC',
    margin: [0.4, 0.55],
    items: [
      { name: 'Lija grip negra 9x33', pesos: 12900, weight: 8, minStock: 8 },
      { name: 'Tornillería 1" Allen', pesos: 6900, weight: 5, minStock: 8 },
      { name: 'Llave en T multiuso', pesos: 14900, weight: 3, minStock: 4 },
      { name: 'Cera para curb', pesos: 8900, weight: 4, minStock: 5 },
      { name: 'Medias altas Ruido (par)', pesos: 8900, weight: 7, minStock: 10 },
      { name: 'Pack stickers x10', pesos: 4900, weight: 9, minStock: 15 },
      { name: 'Riñonera negra', pesos: 39900, weight: 1.5, minStock: 2 },
      { name: 'Casco certificado', pesos: 54900, weight: 1, minStock: 2 },
    ],
  },
}

/** Categorías que recibieron un aumento masivo hace 18 días (cambio de temporada). */
const BULK_CATEGORIES = new Set(['Remeras', 'Buzos', 'Pantalones'])

// Productos que terminan la demo con stock bajo o sin stock, para que el tablero tenga alertas.
const ENDS_LOW = new Set(['TAB-01', 'ACC-01', 'REM-01-M', 'RUE-01', 'BUZ-01-L', 'ACC-06', 'GOR-02'])
const ENDS_OUT = new Set(['ZAP-01-43', 'TAB-03', 'REM-03-S'])

const SHOP_HOURS = [
  { h: 11, weight: 3 }, { h: 12, weight: 4 }, { h: 13, weight: 4 }, { h: 14, weight: 3 }, { h: 15, weight: 4 },
  { h: 16, weight: 6 }, { h: 17, weight: 8 }, { h: 18, weight: 9 }, { h: 19, weight: 7 },
]

const PAYMENT_WEIGHTS: { method: PaymentMethod; weight: number }[] = [
  { method: 'CASH', weight: 20 },
  { method: 'DEBIT', weight: 30 },
  { method: 'TRANSFER', weight: 25 },
  { method: 'CREDIT', weight: 25 },
]

async function main(): Promise<void> {
  // En docker compose el seed corre en cada arranque: con esta variable no pisa datos existentes.
  if (process.env.SEED_ONLY_IF_EMPTY === 'true' && (await prisma.business.count()) > 0) {
    console.log('La base ya tiene datos: no se recarga la demo.')
    return
  }

  console.log('Limpiando base…')
  await prisma.$executeRawUnsafe(
    'TRUNCATE businesses, users, sessions, categories, products, stock_movements, sales, sale_items, price_changes CASCADE',
  )

  const business = await prisma.business.create({ data: { name: BUSINESS_NAME, timezone: TZ } })
  const passwordHash = await argon2.hash(DEMO_PASSWORD)
  const users = await Promise.all(
    USERS.map((u) => prisma.user.create({ data: { ...u, passwordHash, businessId: business.id } })),
  )
  const [owner, manager, ...cashiers] = users
  await prisma.user.create({
    data: { name: 'Julián Torres', email: 'ex-cajero@stocksimple.demo', role: 'CASHIER', passwordHash, businessId: business.id, active: false },
  })

  // Productos
  const today = toLocalIsoDate(new Date(), TZ)
  const startDay = addDays(today, -DAYS)
  const bulkDay = addDays(today, -BULK_INCREASE_DAYS_AGO)
  const at = (day: string, hour: number, minute = 0) =>
    new Date(startOfLocalDay(day, TZ).getTime() + (hour * 60 + minute) * 60_000)

  type SeedProduct = {
    id: string
    sku: string
    name: string
    categoryId: string
    priceCents: number
    costCents: number
    oldPriceCents: number
    oldCostCents: number
    minStock: number
    weight: number
    sold: number
  }
  const products: SeedProduct[] = []
  for (const [categoryName, { prefix, margin, items }] of Object.entries(CATALOG)) {
    const category = await prisma.category.create({ data: { name: categoryName, businessId: business.id } })
    // Precio y costo previos al aumento masivo de hace 18 días (solo en las categorías de temporada).
    const factor = BULK_CATEGORIES.has(categoryName)
      ? { percent: -100 + 100 / (1 + BULK_PERCENT / 100), roundTo: 10000 as const, direction: 'nearest' as const }
      : null
    items.forEach((item, index) => {
      const priceCents = item.pesos * 100
      const costRatio = margin[0] + random() * (margin[1] - margin[0])
      const costCents = Math.round((priceCents * costRatio) / 1000) * 1000
      const base = `${prefix}-${String(index + 1).padStart(2, '0')}`
      // Una prenda por talle: cada talle es un SKU con su propio stock.
      const variants = item.sizes?.map((size) => ({ sku: `${base}-${size}`, name: `${item.name} · ${size}` })) ?? [
        { sku: base, name: item.name },
      ]
      for (const variant of variants) {
        products.push({
          id: randomUUID(),
          sku: variant.sku,
          name: variant.name,
          categoryId: category.id,
          priceCents,
          costCents,
          oldPriceCents: factor ? adjustAmount(priceCents, factor) : priceCents,
          oldCostCents: factor ? adjustAmount(costCents, { ...factor, roundTo: 1 }) : costCents,
          minStock: item.minStock,
          // Los talles del medio se venden más que los extremos.
          weight: item.weight * (variant.sku.endsWith('-M') || variant.sku.endsWith('-L') || variant.sku.endsWith('-41') || variant.sku.endsWith('-42') ? 1.3 : 0.8),
          sold: 0,
        })
      }
    })
  }

  // Ventas: más movimiento los fines de semana y en horario pico.
  type SeedSale = { id: string; at: Date; userId: string; method: PaymentMethod; items: { p: SeedProduct; qty: number }[]; voided: boolean }
  const sales: SeedSale[] = []
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(startDay, d + 1)
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
    const isToday = day === today
    // Una skate shop vende menos tickets que un almacén, pero más caros; el sábado es el día fuerte.
    const base = weekday === 0 ? 4 : weekday === 6 ? 16 : weekday === 5 ? 11 : 8
    const count = isToday ? 0 : base + randomInt(-2, 3)
    for (let s = 0; s < count; s++) {
      const hour = weightedPick(SHOP_HOURS).h
      sales.push(buildSale(at(day, hour, randomInt(0, 59))))
    }
  }
  // Algunas ventas de hoy hasta la hora actual, para que el tablero muestre datos del día.
  const nowLocalHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  const openHoursToday = Math.min(Math.max(0, nowLocalHour - 11), 9)
  for (let s = 0; s < openHoursToday; s++) {
    const hour = randomInt(11, Math.max(11, Math.min(nowLocalHour - 1, 19)))
    sales.push(buildSale(at(today, hour, randomInt(0, 59))))
  }
  sales.sort((a, b) => a.at.getTime() - b.at.getTime())

  function buildSale(when: Date): SeedSale {
    const lines = new Map<string, { p: SeedProduct; qty: number }>()
    const size = weightedPick([{ n: 1, weight: 45 }, { n: 2, weight: 32 }, { n: 3, weight: 16 }, { n: 4, weight: 7 }]).n
    for (let i = 0; i < size; i++) {
      const p = weightedPick(products)
      const line = lines.get(p.id) ?? { p, qty: 0 }
      line.qty += random() < 0.9 ? 1 : 2
      lines.set(p.id, line)
    }
    const seller = random() < 0.8 ? cashiers[randomInt(0, cashiers.length - 1)]! : manager!
    return { id: randomUUID(), at: when, userId: seller.id, method: weightedPick(PAYMENT_WEIGHTS).method, items: [...lines.values()], voided: false }
  }

  // Algunas anulaciones (error de cobro, cliente arrepentido).
  for (const i of [23, 141, 288, 397]) if (sales[i]) sales[i].voided = true
  for (const sale of sales) if (!sale.voided) for (const { p, qty } of sale.items) p.sold += qty

  // Stock final deseado y compras de reposición cada dos semanas.
  const purchaseDays = [addDays(startDay, 14), addDays(startDay, 29)]
  type Movement = { productId: string; userId: string; saleId?: string; type: 'INITIAL' | 'PURCHASE' | 'SALE' | 'SALE_VOID' | 'LOSS'; quantity: number; at: Date; note?: string }
  const movements: Movement[] = []
  for (const p of products) {
    const finalStock = ENDS_OUT.has(p.sku) ? 0 : ENDS_LOW.has(p.sku) ? randomInt(1, p.minStock) : p.minStock + randomInt(2, 10)
    const purchase = Math.max(0, Math.round(p.sold * 0.35))
    const initial = finalStock + p.sold - purchase * 2
    movements.push({ productId: p.id, userId: owner!.id, type: 'INITIAL', quantity: initial, at: at(startDay, 7) })
    for (const day of purchaseDays) {
      if (purchase > 0) movements.push({ productId: p.id, userId: manager!.id, type: 'PURCHASE', quantity: purchase, at: at(day, 7, 30), note: 'Ingreso del proveedor' })
    }
  }
  for (const sale of sales) {
    for (const { p, qty } of sale.items) {
      movements.push({ productId: p.id, userId: sale.userId, saleId: sale.id, type: 'SALE', quantity: -qty, at: sale.at })
      if (sale.voided) {
        movements.push({ productId: p.id, userId: manager!.id, saleId: sale.id, type: 'SALE_VOID', quantity: qty, at: new Date(sale.at.getTime() + 5 * 60_000), note: 'Cobro duplicado' })
      }
    }
  }
  movements.sort((a, b) => a.at.getTime() - b.at.getTime())

  // Recorremos el libro en orden para calcular el stock después de cada movimiento.
  // Si en algún momento quedaría negativo, se agrega ese faltante al stock inicial.
  const running = new Map<string, number>()
  const deficit = new Map<string, number>()
  for (const m of movements) {
    const value = (running.get(m.productId) ?? 0) + m.quantity
    running.set(m.productId, value)
    if (value < 0) deficit.set(m.productId, Math.max(deficit.get(m.productId) ?? 0, -value))
  }
  for (const m of movements) if (m.type === 'INITIAL') m.quantity += deficit.get(m.productId) ?? 0
  running.clear()
  const movementRows = movements.map((m) => {
    const stockAfter = (running.get(m.productId) ?? 0) + m.quantity
    running.set(m.productId, stockAfter)
    return {
      businessId: business.id,
      productId: m.productId,
      userId: m.userId,
      saleId: m.saleId,
      type: m.type,
      quantity: m.quantity,
      stockAfter,
      note: m.note,
      createdAt: m.at,
    }
  })

  console.log(`Cargando ${products.length} productos…`)
  await prisma.product.createMany({
    data: products.map((p, i) => ({
      id: p.id,
      businessId: business.id,
      categoryId: p.categoryId,
      sku: p.sku,
      barcode: ean13(i + 1),
      name: p.name,
      priceCents: p.priceCents,
      costCents: p.costCents,
      stock: running.get(p.id) ?? 0,
      minStock: p.minStock,
      createdAt: at(startDay, 7),
    })),
  })

  const bulkAt = at(bulkDay, 7, 15)
  const bulkBatch = randomUUID()
  await prisma.priceChange.createMany({
    data: products
      .filter((p) => p.oldPriceCents !== p.priceCents)
      .map((p) => ({
        businessId: business.id,
        productId: p.id,
        userId: owner!.id,
        batchId: bulkBatch,
        reason: 'BULK' as const,
        oldPriceCents: p.oldPriceCents,
        newPriceCents: p.priceCents,
        oldCostCents: p.oldCostCents,
        newCostCents: p.costCents,
        createdAt: bulkAt,
      })),
  })

  console.log(`Cargando ${sales.length} ventas…`)
  const priceAt = (p: SeedProduct, when: Date) => (when < bulkAt ? p.oldPriceCents : p.priceCents)
  const costAt = (p: SeedProduct, when: Date) => (when < bulkAt ? p.oldCostCents : p.costCents)
  for (let i = 0; i < sales.length; i += 500) {
    const chunk = sales.slice(i, i + 500)
    await prisma.sale.createMany({
      data: chunk.map((s, j) => ({
        id: s.id,
        businessId: business.id,
        number: i + j + 1,
        userId: s.userId,
        idempotencyKey: randomUUID(),
        paymentMethod: s.method,
        status: s.voided ? ('VOIDED' as const) : ('COMPLETED' as const),
        totalCents: s.items.reduce((sum, { p, qty }) => sum + priceAt(p, s.at) * qty, 0),
        costCents: s.items.reduce((sum, { p, qty }) => sum + costAt(p, s.at) * qty, 0),
        createdAt: s.at,
        voidedAt: s.voided ? new Date(s.at.getTime() + 5 * 60_000) : null,
        voidedById: s.voided ? manager!.id : null,
        voidReason: s.voided ? 'Cobro duplicado' : null,
      })),
    })
    await prisma.saleItem.createMany({
      data: chunk.flatMap((s) =>
        s.items.map(({ p, qty }) => ({
          saleId: s.id,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          quantity: qty,
          unitPriceCents: priceAt(p, s.at),
          unitCostCents: costAt(p, s.at),
          subtotalCents: priceAt(p, s.at) * qty,
        })),
      ),
    })
  }
  await prisma.business.update({ where: { id: business.id }, data: { saleCounter: sales.length } })

  console.log(`Cargando ${movementRows.length} movimientos de stock…`)
  for (let i = 0; i < movementRows.length; i += 2000) {
    await prisma.stockMovement.createMany({ data: movementRows.slice(i, i + 2000) })
  }

  console.log('\nListo. Usuarios de prueba (contraseña: demo1234):')
  for (const u of USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
