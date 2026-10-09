import { createHmac } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PROXY_SIGNATURE_HEADER } from '../src/common/proxy-signature'
import type { PrismaService } from '../src/prisma/prisma.service'
import { PASSWORD, auth, createTestApp, resetDatabase } from './helpers'

const SECRET = 'proxy-secret-proxy-secret-proxy-secret'

// Se activa antes de importar la app: la configuración se valida al cargar el módulo.
vi.hoisted(() => {
  process.env.PROXY_SIGNATURE_SECRET = 'proxy-secret-proxy-secret-proxy-secret'
})

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** La firma que agrega Netlify a cada pedido que reenvía. */
function netlifySignature(secret = SECRET): string {
  const head = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'netlify', exp: Math.floor(Date.now() / 1000) + 60 })}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

const signed = () => ({ [PROXY_SIGNATURE_HEADER]: netlifySignature() })

describe('Proxy firmado (solo se entra por Netlify)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let email: string

  beforeAll(async () => {
    ;({ app, prisma } = await createTestApp())
    await resetDatabase(prisma)
    // createFixture inicia sesión sin firma: acá se arma el usuario a mano.
    const business = await prisma.business.create({ data: { name: 'Shop' } })
    const argon2 = await import('argon2')
    email = 'duena@proxy.dev'
    await prisma.user.create({
      data: { businessId: business.id, name: 'Laura', email, role: 'OWNER', passwordHash: await argon2.hash(PASSWORD) },
    })
  })
  afterAll(async () => {
    delete process.env.PROXY_SIGNATURE_SECRET
    await app.close()
  })

  const http = () => request(app.getHttpServer())

  it('rechaza los pedidos directos, sin firma o firmados con otro secreto', async () => {
    const direct = await http().post('/api/auth/login').send({ email, password: PASSWORD }).expect(403)
    expect(direct.body.code).toBe('FORBIDDEN')
    await http()
      .post('/api/auth/login')
      .set(PROXY_SIGNATURE_HEADER, netlifySignature('otro-secreto-otro-secreto-otro-secreto'))
      .send({ email, password: PASSWORD })
      .expect(403)
  })

  it('acepta los pedidos que llegan firmados por el proxy', async () => {
    const login = await http().post('/api/auth/login').set(signed()).send({ email, password: PASSWORD }).expect(200)
    const me = await http().get('/api/auth/me').set(signed()).set(auth(login.body.accessToken)).expect(200)
    expect(me.body.email).toBe(email)
    // Un token válido no alcanza si el pedido no pasó por el proxy.
    const direct = await http().get('/api/auth/me').set(auth(login.body.accessToken)).expect(403)
    expect(direct.body.code).toBe('FORBIDDEN')
  })

  it('deja abiertos el health check de Render y la documentación', async () => {
    expect((await http().get('/api/health').expect(200)).body.status).toBe('ok')
    expect((await http().get('/api/docs-json').expect(200)).body.info.title).toBe('Stock Simple API')
  })
})
