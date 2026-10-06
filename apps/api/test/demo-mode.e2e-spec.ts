import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { PASSWORD, type Fixture, auth, createFixture, createTestApp, login, resetDatabase } from './helpers'

// Se activa antes de importar la app: la configuración se valida al cargar el módulo.
vi.hoisted(() => {
  process.env.DEMO_MODE = 'true'
})

describe('Modo demo (cuentas compartidas)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let shop: Fixture

  beforeAll(async () => {
    ;({ app, prisma } = await createTestApp())
    await resetDatabase(prisma)
    shop = await createFixture(app, prisma)
  })
  afterAll(() => app.close())

  const http = () => request(app.getHttpServer())

  it('avisa a la web que es una demo', async () => {
    const res = await http().get('/api/auth/me').set(auth(shop.tokens.OWNER)).expect(200)
    expect(res.body.demoMode).toBe(true)
  })

  it('nadie puede cambiar contraseñas ni desactivar cuentas, ni siquiera la dueña', async () => {
    const cashierId = shop.userIds.CASHIER
    const change = await http()
      .patch(`/api/users/${cashierId}`)
      .set(auth(shop.tokens.OWNER))
      .send({ password: 'otra-clave-123' })
      .expect(403)
    expect(change.body.code).toBe('DEMO_READ_ONLY')

    await http().patch(`/api/users/${cashierId}`).set(auth(shop.tokens.OWNER)).send({ active: false }).expect(403)

    // La cajera sigue pudiendo entrar con la contraseña de siempre.
    const cashier = await prisma.user.findUniqueOrThrow({ where: { id: cashierId } })
    expect(cashier.active).toBe(true)
    await expect(login(app, cashier.email, PASSWORD)).resolves.toEqual(expect.any(String))
  })

  it('no se pueden crear usuarios nuevos', async () => {
    const before = await prisma.user.count()
    const res = await http()
      .post('/api/users')
      .set(auth(shop.tokens.OWNER))
      .send({ name: 'Intruso', email: 'intruso@test.dev', password: 'clave-12345', role: 'OWNER' })
      .expect(403)
    expect(res.body.code).toBe('DEMO_READ_ONLY')
    expect(await prisma.user.count()).toBe(before)
  })

  it('el resto de la app funciona normal: se puede vender', async () => {
    const productId = await shop.product({ stock: 3 })
    const res = await http()
      .post('/api/sales')
      .set(auth(shop.tokens.CASHIER))
      .send({ idempotencyKey: crypto.randomUUID(), paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] })
      .expect(201)
    expect(res.body.status).toBe('COMPLETED')
  })
})
