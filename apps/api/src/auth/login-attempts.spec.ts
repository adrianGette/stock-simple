import { describe, expect, it } from 'vitest'
import { FAILED_LOGIN_WINDOW_MS, LoginAttempts, MAX_FAILED_LOGINS } from './login-attempts'

function setup() {
  let now = 0
  const attempts = new LoginAttempts(() => now)
  const fail = (email: string, times: number) => {
    for (let i = 0; i < times; i++) attempts.recordFailure(email)
  }
  return { attempts, fail, advance: (ms: number) => (now += ms) }
}

describe('LoginAttempts', () => {
  it('bloquea la cuenta al llegar al máximo de intentos fallidos', () => {
    const { attempts, fail } = setup()
    fail('laura@shop.dev', MAX_FAILED_LOGINS - 1)
    expect(attempts.isLocked('laura@shop.dev')).toBe(false)
    fail('laura@shop.dev', 1)
    expect(attempts.isLocked('laura@shop.dev')).toBe(true)
  })

  it('el bloqueo es por cuenta: las demás siguen pudiendo ingresar', () => {
    const { attempts, fail } = setup()
    fail('laura@shop.dev', MAX_FAILED_LOGINS)
    expect(attempts.isLocked('sofia@shop.dev')).toBe(false)
  })

  it('se libera sola cuando termina la ventana', () => {
    const { attempts, fail, advance } = setup()
    fail('laura@shop.dev', MAX_FAILED_LOGINS)
    advance(FAILED_LOGIN_WINDOW_MS - 1)
    expect(attempts.isLocked('laura@shop.dev')).toBe(true)
    advance(1)
    expect(attempts.isLocked('laura@shop.dev')).toBe(false)
  })

  it('un ingreso correcto reinicia el contador', () => {
    const { attempts, fail } = setup()
    fail('laura@shop.dev', MAX_FAILED_LOGINS - 1)
    attempts.recordSuccess('laura@shop.dev')
    fail('laura@shop.dev', MAX_FAILED_LOGINS - 1)
    expect(attempts.isLocked('laura@shop.dev')).toBe(false)
  })

  it('no crece sin límite con emails inventados, y conserva los bloqueos recientes', () => {
    const { attempts, fail } = setup()
    for (let i = 0; i < 20_000; i++) attempts.recordFailure(`bot-${i}@spam.dev`)
    fail('laura@shop.dev', MAX_FAILED_LOGINS)
    expect(attempts.isLocked('laura@shop.dev')).toBe(true)
    expect(attempts.isLocked('bot-0@spam.dev')).toBe(false)
  })
})
