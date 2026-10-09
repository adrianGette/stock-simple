import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  JWT_ACCESS_SECRET: z.string().min(32, 'Usá un secreto de al menos 32 caracteres'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  /**
   * 'lax' cuando la web llega a la API por el mismo origen (proxy de Netlify, recomendado).
   * 'none' solo si web y API viven en dominios distintos sin proxy (cookie de terceros).
   */
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  /**
   * Fuerza el atributo Secure de la cookie de sesión. Por defecto: activo en producción.
   * Se apaga solo para correr la imagen de producción en http://localhost (docker compose).
   */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  /** Cantidad de proxies delante de la API (Netlify + Render = 2), para que el rate limit vea la IP real. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  /**
   * Secreto con el que Netlify firma los pedidos que reenvía (proxy firmado, ver netlify.toml).
   * Si está definido, la API rechaza todo pedido sin una firma válida, salvo el health check y Swagger.
   * Sin definir (desarrollo, docker compose) no se exige firma.
   */
  PROXY_SIGNATURE_SECRET: z.string().min(32, 'Usá un secreto de al menos 32 caracteres').optional(),
  /** Demo pública con cuentas compartidas: impide crear o modificar usuarios. */
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof envSchema>

/** Falla al arrancar si falta o es inválida alguna variable, en lugar de fallar en runtime. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
