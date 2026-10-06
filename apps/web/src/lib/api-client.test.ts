import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ApiError, api, serverStatusStore, waitForServer } from './api-client'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

/** Simula el hosting gratuito: las primeras N respuestas son 502 mientras la API arranca. */
function sleepingApi(wakeAfter: number) {
  let calls = 0
  server.use(
    http.get('*/api/health', () => (++calls > wakeAfter ? HttpResponse.json({ status: 'ok' }) : new HttpResponse(null, { status: 502 }))),
  )
  return () => calls
}

describe('waitForServer', () => {
  it('reintenta /health hasta que el servidor despierta', async () => {
    const calls = sleepingApi(2)
    await expect(waitForServer({ intervalMs: 5 })).resolves.toBe(true)
    expect(calls()).toBe(3)
    expect(serverStatusStore.get()).toBe('ready')
  })
})

describe('api', () => {
  it('no reintenta solas las escrituras si el proxy corta (podrían duplicarse)', async () => {
    let posts = 0
    server.use(
      http.post('*/api/sales', () => {
        posts++
        return new HttpResponse(null, { status: 504 })
      }),
      http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })),
    )
    const error = await api('/sales', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toMatch(/despertando/)
    expect(posts).toBe(1)
  })
})
