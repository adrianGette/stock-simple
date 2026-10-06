import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { PASSWORD, auth, createFixture, createTestApp, resetDatabase } from './helpers'

const refreshCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ss_refresh='))!.split(';')[0]!

describe('Auth', () => {
  let app: INestApplication
  let prisma: PrismaService
  let email: string

  beforeAll(async () => ({ app, prisma } = await createTestApp()))
  afterAll(() => app.close())

  beforeEach(async () => {
    await resetDatabase(prisma)
    const fixture = await createFixture(app, prisma)
    email = (await prisma.user.findUniqueOrThrow({ where: { id: fixture.userIds.OWNER } })).email
  })

  const http = () => request(app.getHttpServer())

  it('devuelve un access token y setea la cookie httpOnly de refresh', async () => {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)
    expect(res.body).toMatchObject({ accessToken: expect.any(String), user: { email, role: 'OWNER' } })
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/)
    await http().get('/api/auth/me').set(auth(res.body.accessToken)).expect(200)
  })

  it('rechaza credenciales inválidas con un mensaje genérico', async () => {
    const wrongPassword = await http().post('/api/auth/login').send({ email, password: 'nope' }).expect(401)
    const unknownEmail = await http().post('/api/auth/login').send({ email: 'x@test.dev', password: 'nope' }).expect(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('exige token en rutas privadas', async () => {
    const res = await http().get('/api/products').expect(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
  })

  it('rota el refresh token y detecta la reutilización de uno viejo', async () => {
    const login = await http().post('/api/auth/login').send({ email, password: PASSWORD })
    const first = refreshCookie(login)

    const refreshed = await http().post('/api/auth/refresh').set('Cookie', first).expect(200)
    const second = refreshCookie(refreshed)
    expect(second).not.toEqual(first)

    // Simulamos que el token viejo se reutiliza pasada la ventana de gracia (posible robo).
    await prisma.session.updateMany({ where: { revokedAt: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } })
    await http().post('/api/auth/refresh').set('Cookie', first).expect(401)

    // Toda la familia queda revocada: el token nuevo tampoco sirve.
    await http().post('/api/auth/refresh').set('Cookie', second).expect(401)
  })

  it('logout invalida el refresh token', async () => {
    const login = await http().post('/api/auth/login').send({ email, password: PASSWORD })
    const cookie = refreshCookie(login)
    await http().post('/api/auth/logout').set('Cookie', cookie).expect(204)
    const res = await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
  })

  it('un usuario desactivado pierde el acceso al instante', async () => {
    const token = (await http().post('/api/auth/login').send({ email, password: PASSWORD })).body.accessToken
    await prisma.user.update({ where: { email }, data: { active: false } })
    await http().get('/api/auth/me').set(auth(token)).expect(401)
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD }).expect(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })
})
