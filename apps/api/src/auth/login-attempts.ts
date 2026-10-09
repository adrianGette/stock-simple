/** Intentos fallidos permitidos por cuenta dentro de la ventana, antes de bloquearla por el resto de la ventana. */
export const MAX_FAILED_LOGINS = 10
export const FAILED_LOGIN_WINDOW_MS = 15 * 60_000
/** Tope de cuentas seguidas a la vez: alguien que prueba emails inventados no puede llenar la memoria. */
const MAX_TRACKED = 10_000

interface Attempts {
  failures: number
  resetAt: number
}

/**
 * Límite de logins fallidos por cuenta, además del límite por IP: frena a quien prueba contraseñas
 * contra una misma cuenta desde muchas IPs. Vive en memoria porque la API corre en una sola instancia;
 * si se reinicia, los contadores vuelven a cero (acotado: es solo una ventana de 15 minutos).
 */
export class LoginAttempts {
  private readonly byEmail = new Map<string, Attempts>()

  constructor(private readonly now: () => number = Date.now) {}

  isLocked(email: string): boolean {
    const attempts = this.current(email)
    return attempts !== undefined && attempts.failures >= MAX_FAILED_LOGINS
  }

  recordFailure(email: string): void {
    const attempts = this.current(email)
    if (attempts) {
      attempts.failures++
      return
    }
    if (this.byEmail.size >= MAX_TRACKED) this.prune()
    this.byEmail.set(email, { failures: 1, resetAt: this.now() + FAILED_LOGIN_WINDOW_MS })
  }

  recordSuccess(email: string): void {
    this.byEmail.delete(email)
  }

  private current(email: string): Attempts | undefined {
    const attempts = this.byEmail.get(email)
    if (attempts && attempts.resetAt <= this.now()) {
      this.byEmail.delete(email)
      return undefined
    }
    return attempts
  }

  /** Borra las ventanas vencidas y, si sigue lleno, las más viejas (el Map conserva el orden de inserción). */
  private prune(): void {
    const now = this.now()
    for (const [email, attempts] of this.byEmail) {
      if (attempts.resetAt <= now) this.byEmail.delete(email)
    }
    for (const email of this.byEmail.keys()) {
      if (this.byEmail.size < MAX_TRACKED) break
      this.byEmail.delete(email)
    }
  }
}
