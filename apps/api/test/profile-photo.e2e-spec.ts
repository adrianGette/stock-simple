import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { PROFILE_PHOTO_MAX_BYTES } from '@stock/shared'
import request from 'supertest'
import type { PrismaService } from '../src/prisma/prisma.service'
import { type Fixture, auth, createFixture, createTestApp, resetDatabase } from './helpers'

/** Bytes con la firma de un WebP ("RIFF" … "WEBP"); el servidor no decodifica la imagen, solo verifica la firma. */
const webp = (size = 64) => {
  const bytes = Buffer.alloc(size)
  bytes.write('RIFF', 0, 'ascii')
  bytes.write('WEBP', 8, 'ascii')
  return bytes
}

describe('Foto de perfil', () => {
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
  const upload = (token: string, body: Buffer, type = 'image/webp') =>
    http().put('/api/users/me/photo').set(auth(token)).set('Content-Type', type).send(body)

  it('cada persona sube su foto y cualquiera del comercio la ve', async () => {
    const photo = webp()
    const res = await upload(shop.tokens.CASHIER, photo).expect(200)
    expect(res.body.photoVersion).toEqual(expect.any(String))

    const seen = await http().get(`/api/users/${shop.userIds.CASHIER}/photo`).set(auth(shop.tokens.OWNER)).buffer(true).expect(200)
    expect(seen.headers['content-type']).toBe('image/webp')
    expect(seen.headers['cache-control']).toBe('private, max-age=31536000, immutable')
    expect(Buffer.compare(seen.body as Buffer, photo)).toBe(0)
  })

  it('la versión de la foto viaja con la sesión, el equipo y las ventas (los bytes no)', async () => {
    const { photoVersion } = (await upload(shop.tokens.OWNER, webp()).expect(200)).body

    const me = await http().get('/api/auth/me').set(auth(shop.tokens.OWNER)).expect(200)
    expect(me.body.photoVersion).toBe(photoVersion)

    const team = await http().get('/api/users').set(auth(shop.tokens.OWNER)).expect(200)
    const owner = team.body.find((u: { id: string }) => u.id === shop.userIds.OWNER)
    expect(owner).toMatchObject({ photoVersion })
    expect(owner).not.toHaveProperty('photo')

    const productId = await shop.product()
    await http()
      .post('/api/sales')
      .set(auth(shop.tokens.OWNER))
      .send({ idempotencyKey: randomUUID(), paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] })
      .expect(201)
    const sales = await http().get('/api/sales').set(auth(shop.tokens.OWNER)).expect(200)
    expect(sales.body.items[0].user).toEqual({ id: shop.userIds.OWNER, name: 'OWNER test', photoVersion })
  })

  it('acepta JPEG (Safari no siempre genera WebP) y la sirve con su tipo real', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])
    await upload(shop.tokens.OWNER, jpeg, 'image/jpeg').expect(200)
    const seen = await http().get(`/api/users/${shop.userIds.OWNER}/photo`).set(auth(shop.tokens.OWNER)).buffer(true).expect(200)
    expect(seen.headers['content-type']).toBe('image/jpeg')
  })

  it('al quitarla vuelve a no tener foto', async () => {
    await upload(shop.tokens.MANAGER, webp()).expect(200)
    await http().delete('/api/users/me/photo').set(auth(shop.tokens.MANAGER)).expect(204)

    expect((await http().get('/api/auth/me').set(auth(shop.tokens.MANAGER))).body.photoVersion).toBeNull()
    await http().get(`/api/users/${shop.userIds.MANAGER}/photo`).set(auth(shop.tokens.OWNER)).expect(404)
  })

  it('rechaza lo que no es WebP aunque diga serlo, y las fotos de más de 200 KB', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0])
    const fake = await upload(shop.tokens.OWNER, png)
    expect(fake.status).toBe(400)
    expect(fake.body.message).toBe('La foto tiene que ser una imagen WebP o JPEG.')

    const huge = await upload(shop.tokens.OWNER, webp(PROFILE_PHOTO_MAX_BYTES + 1))
    expect(huge.status).toBe(413)
    expect(huge.body.message).toBe('El archivo supera el máximo de 200 KB.')

    const json = await http().put('/api/users/me/photo').set(auth(shop.tokens.OWNER)).send({ photo: 'x' })
    expect(json.status).toBe(415)
  })

  it('no se pueden ver fotos de otro comercio', async () => {
    const other = await createFixture(app, prisma, 'Otro comercio')
    await upload(other.tokens.OWNER, webp()).expect(200)
    const res = await http().get(`/api/users/${other.userIds.OWNER}/photo`).set(auth(shop.tokens.OWNER))
    expect(res.status).toBe(404)
  })
})
