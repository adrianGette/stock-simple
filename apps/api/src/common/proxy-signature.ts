import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { ApiErrorBody } from '@stock/shared'

/** Encabezado con el que Netlify firma cada pedido que reenvía a la API (proxy firmado). */
export const PROXY_SIGNATURE_HEADER = 'x-nf-sign'

/**
 * Rutas que se aceptan sin firma: el health check lo hace Render directo (no pasa por Netlify)
 * y la documentación de Swagger no expone datos.
 */
const UNSIGNED_PATHS = [/^\/api\/health\/?$/, /^\/api\/docs(\/|-json|$)/]

const base64url = (value: string) => Buffer.from(value, 'base64url')

/**
 * Verifica el JWS que agrega Netlify (HS256, emisor "netlify", con vencimiento).
 * Se valida a mano porque es un formato fijo y chico: no hace falta otra dependencia.
 */
export function isValidProxySignature(token: string | undefined, secret: string, now = Date.now()): boolean {
  const parts = token?.split('.')
  if (parts?.length !== 3) return false
  const [header, payload, signature] = parts as [string, string, string]
  try {
    if (JSON.parse(base64url(header).toString('utf8')).alg !== 'HS256') return false
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
    const received = base64url(signature)
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false
    const claims = JSON.parse(base64url(payload).toString('utf8')) as { iss?: unknown; exp?: unknown }
    return claims.iss === 'netlify' && typeof claims.exp === 'number' && claims.exp * 1000 > now
  } catch {
    return false
  }
}

/**
 * Solo acepta pedidos que llegan por el proxy de Netlify. Así nadie puede pegarle directo a Render
 * con un X-Forwarded-For inventado para esquivar el rate limit (que se basa en la IP del cliente).
 */
export function requireProxySignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (UNSIGNED_PATHS.some((path) => path.test(req.path)) || isValidProxySignature(req.get(PROXY_SIGNATURE_HEADER), secret)) {
      next()
      return
    }
    const body: ApiErrorBody = { statusCode: 403, code: 'FORBIDDEN', message: 'Acceso directo no permitido: usá la app web.' }
    res.status(403).json(body)
  }
}
