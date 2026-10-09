import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isValidProxySignature } from './proxy-signature'

const SECRET = 'proxy-secret-proxy-secret-proxy-secret'
const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** Arma un JWS como el que manda Netlify en x-nf-sign. */
function sign(claims: object, { secret = SECRET, alg = 'HS256' } = {}): string {
  const head = `${encode({ alg, typ: 'JWT' })}.${encode(claims)}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

const valid = { iss: 'netlify', exp: NOW / 1000 + 60, site_url: 'https://stock-simple-adrian.netlify.app' }

describe('isValidProxySignature', () => {
  it('acepta la firma de Netlify con el secreto compartido', () => {
    expect(isValidProxySignature(sign(valid), SECRET, NOW)).toBe(true)
  })

  it('rechaza una firma hecha con otro secreto', () => {
    expect(isValidProxySignature(sign(valid, { secret: 'otro-secreto-otro-secreto-otro-secreto' }), SECRET, NOW)).toBe(false)
  })

  it('rechaza una firma vencida o de otro emisor', () => {
    expect(isValidProxySignature(sign({ ...valid, exp: NOW / 1000 - 1 }), SECRET, NOW)).toBe(false)
    expect(isValidProxySignature(sign({ ...valid, exp: undefined }), SECRET, NOW)).toBe(false)
    expect(isValidProxySignature(sign({ ...valid, iss: 'otro' }), SECRET, NOW)).toBe(false)
  })

  it('rechaza otro algoritmo y un payload alterado', () => {
    expect(isValidProxySignature(sign(valid, { alg: 'none' }), SECRET, NOW)).toBe(false)
    const [head, , signature] = sign(valid).split('.')
    expect(isValidProxySignature(`${head}.${encode({ ...valid, iss: 'netlify', extra: 1 })}.${signature}`, SECRET, NOW)).toBe(false)
  })

  it('rechaza encabezados ausentes o mal formados sin lanzar errores', () => {
    for (const token of [undefined, '', 'abc', 'a.b', 'a.b.c', '!!.??.**']) {
      expect(isValidProxySignature(token, SECRET, NOW)).toBe(false)
    }
  })
})
