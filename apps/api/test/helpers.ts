import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Role } from '@stock/shared'
import * as argon2 from 'argon2'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { setupApp } from '../src/setup-app'

export const PASSWORD = 'secret-123'
let passwordHash: Promise<string> | undefined

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  setupApp(app)
  // Escuchar en un puerto efímero evita que supertest abra un servidor por cada request.
  await app.listen(0)
  return { app, prisma: app.get(PrismaService) }
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE businesses, users, sessions, categories, products, stock_movements, sales, sale_items, price_changes CASCADE',
  )
}

export interface Fixture {
  businessId: string
  tokens: Record<Role, string>
  userIds: Record<Role, string>
  categoryId: string
  product: (overrides?: Partial<{ stock: number; priceCents: number; costCents: number; minStock: number }>) => Promise<string>
}

/** Crea un comercio con un usuario por rol, una categoría y devuelve tokens listos para usar. */
export async function createFixture(app: INestApplication, prisma: PrismaService, name = 'Skate shop de prueba'): Promise<Fixture> {
  passwordHash ??= argon2.hash(PASSWORD)
  const business = await prisma.business.create({ data: { name } })
  const roles: Role[] = ['OWNER', 'MANAGER', 'CASHIER']
  const tokens = {} as Record<Role, string>
  const userIds = {} as Record<Role, string>
  for (const role of roles) {
    const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@test.dev`
    const user = await prisma.user.create({
      data: { businessId: business.id, name: `${role} test`, email, role, passwordHash: await passwordHash },
    })
    userIds[role] = user.id
    tokens[role] = await login(app, email)
  }
  const category = await prisma.category.create({ data: { businessId: business.id, name: 'General' } })

  let counter = 0
  const product: Fixture['product'] = async (overrides = {}) => {
    counter++
    const created = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        sku: `SKU-${counter}`,
        name: `Producto ${counter}`,
        costCents: overrides.costCents ?? 60_000,
        priceCents: overrides.priceCents ?? 100_000,
        stock: overrides.stock ?? 10,
        minStock: overrides.minStock ?? 2,
      },
    })
    return created.id
  }

  return { businessId: business.id, tokens, userIds, categoryId: category.id, product }
}

export async function login(app: INestApplication, email: string, password = PASSWORD): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password }).expect(200)
  return res.body.accessToken as string
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
