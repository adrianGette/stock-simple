import type { ApiErrorBody, AuthResponse, ErrorCode } from '@stock/shared'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Sesión en memoria: el access token nunca se guarda en localStorage (un XSS no lo puede robar
 * de ahí). Al recargar la página se recupera con la cookie httpOnly de refresh.
 */
let accessToken: string | null = null
let refreshing: Promise<AuthResponse | null> | null = null
let onSessionChange: ((session: AuthResponse | null) => void) | null = null

// Marca no sensible (no es el token): indica si vale la pena intentar recuperar la sesión al cargar.
const SESSION_HINT_KEY = 'stock-simple:has-session'
function setSessionHint(active: boolean) {
  try {
    if (active) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    // sin storage: siempre se intenta el refresh
  }
}
export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return true
  }
}

export const session = {
  set(response: AuthResponse | null) {
    accessToken = response?.accessToken ?? null
    setSessionHint(response !== null)
  },
  /** El AuthProvider se suscribe para enterarse cuando la sesión se renueva o vence. */
  subscribe(listener: (session: AuthResponse | null) => void) {
    onSessionChange = listener
    return () => {
      onSessionChange = null
    }
  },
}

/**
 * Despertar del servidor. En el plan gratuito de hosting la API se duerme tras un rato sin uso
 * y tarda hasta un minuto en volver; el proxy de Netlify corta antes, así que la primera request
 * fallaría. Antes de operar se consulta /health (idempotente) hasta que responda.
 */
export type ServerStatus = 'unknown' | 'waking' | 'ready' | 'unreachable'

let serverStatus: ServerStatus = 'unknown'
let serverReady: Promise<boolean> | null = null
const statusListeners = new Set<() => void>()

function setServerStatus(status: ServerStatus) {
  serverStatus = status
  statusListeners.forEach((listener) => listener())
}

export const serverStatusStore = {
  get: () => serverStatus,
  subscribe(listener: () => void) {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  },
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function waitForServer({ timeoutMs = 90_000, intervalMs = 3_000 } = {}): Promise<boolean> {
  if (serverStatus === 'ready') return Promise.resolve(true)
  serverReady ??= (async () => {
    const deadline = Date.now() + timeoutMs
    // Si en 1,5 s no contestó, avisamos que se está despertando.
    const slow = setTimeout(() => serverStatus !== 'ready' && setServerStatus('waking'), 1_500)
    try {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${BASE_URL}/health`, { cache: 'no-store' })
          if (res.ok) {
            setServerStatus('ready')
            return true
          }
        } catch {
          // sin respuesta todavía: seguimos esperando
        }
        setServerStatus('waking')
        await sleep(intervalMs)
      }
      setServerStatus('unreachable')
      return false
    } finally {
      clearTimeout(slow)
      serverReady = null
    }
  })()
  return serverReady
}

const isWakingResponse = (status: number) => status === 502 || status === 503 || status === 504

/**
 * Renueva el access token. Si varias requests reciben 401 a la vez, comparten
 * una única renovación en vuelo en lugar de rotar el refresh token varias veces.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => (res.ok ? ((await res.json()) as AuthResponse) : null))
    .catch(() => null)
    .then((result) => {
      session.set(result)
      onSessionChange?.(result)
      return result
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * Descarga un archivo de la API. Va por `fetch` y no por un link común porque necesita el token,
 * que vive en memoria; después se le entrega al navegador como si fuera un link de descarga.
 */
export async function downloadFile(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await request(path, options)
  const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'descarga'
  saveFile(await response.blob(), filename)
}

/** Le entrega un archivo generado en el navegador al usuario, como si viniera de un link de descarga. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Se libera en el próximo ciclo: algunos navegadores todavía están leyendo el blob al volver de click().
  setTimeout(() => URL.revokeObjectURL(url))
}

/** Hace la request con el token, reintenta si el servidor se estaba despertando o si la sesión venció, y normaliza los errores. */
async function request(path: string, options: RequestOptions, retried = false): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }

  const method = options.method ?? 'GET'
  // Un archivo (Blob) viaja tal cual, con su propio tipo; cualquier otro cuerpo, como JSON.
  const isFile = options.body instanceof Blob
  let response: Response
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      signal: options.signal,
      headers: {
        ...(options.body !== undefined && { 'Content-Type': isFile ? (options.body as Blob).type : 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: isFile ? (options.body as Blob) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // Las lecturas se reintentan solas una vez que el servidor despertó.
    if (method === 'GET' && !retried && (await waitForServer())) return request(path, options, true)
    throw new ApiError(0, 'INTERNAL_ERROR', 'No hay conexión con el servidor. Revisá tu conexión e intentá de nuevo.')
  }

  if (isWakingResponse(response.status)) {
    if (method === 'GET' && !retried && (await waitForServer())) return request(path, options, true)
    // Las escrituras no se reintentan solas (podrían duplicarse); el usuario reintenta.
    void waitForServer()
    throw new ApiError(response.status, 'INTERNAL_ERROR', 'El servidor se está despertando. Probá de nuevo en unos segundos.')
  }

  if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
    const renewed = await refreshSession()
    if (renewed) return request(path, options, true)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(
      response.status,
      body?.code ?? 'INTERNAL_ERROR',
      body?.message ?? 'Ocurrió un error inesperado',
      body?.details,
    )
  }

  return response
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado'
}
