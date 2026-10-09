import { zodResolver } from '@hookform/resolvers/zod'
import { type LoginInput, loginSchema } from '@stock/shared'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../../lib/api-client'
import { Button } from '../../shared/ui/Button'
import { Field, Input } from '../../shared/ui/Field'
import { Icon } from '../../shared/ui/Icon'
import { useAuth } from './AuthProvider'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, showDemoAccounts } from './demo-accounts'
import styles from './LoginPage.module.css'

const FEATURES = [
  'Caja rápida, con lector de código de barras',
  'Stock al día, con el historial de cada movimiento',
  'Aumentos de precios masivos con redondeo comercial',
  'Reportes de ventas y ganancia, exportables a Excel',
  'Importación y conteo de inventario con planillas',
]

export function LoginPage() {
  const { state, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: 'onTouched', defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  if (state.status === 'authenticated') return <Navigate to={from} replace />

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (error) {
      setSubmitError(errorMessage(error))
    }
  })

  const loginAsDemo = (email: string) => {
    form.setValue('email', email)
    form.setValue('password', DEMO_PASSWORD)
    void submit()
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.brandPanel}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>
            <Icon name="box" size={18} />
          </span>
          Stock Simple
        </div>
        <div className={styles.pitch}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowTag}>Nuevo</span> Importá tu catálogo desde una planilla
          </span>
          <h1>
            Vendé, controlá y <span className={styles.highlight}>decidí con datos.</span>
          </h1>
          <p>Ventas, stock, precios y reportes en un solo lugar.</p>
        </div>
        <ul className={styles.features}>
          {FEATURES.map((feature) => (
            <li key={feature}>
              <Icon name="check" size={16} /> {feature}
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.formPanel}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div>
            <h2 className={styles.formTitle}>Ingresar</h2>
            <p className={styles.formSubtitle}>Usá tu cuenta del comercio.</p>
          </div>

          {submitError && (
            <div className={styles.alert} role="alert">
              <Icon name="alert" size={16} /> {submitError}
            </div>
          )}

          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" placeholder="vos@comercio.com" {...form.register('email')} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
            Ingresar
          </Button>

          {showDemoAccounts && (
            <>
              <p className={styles.divider}>o probá la demo como</p>
              <div className={styles.demoList}>
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className={styles.demoButton}
                    onClick={() => loginAsDemo(account.email)}
                    disabled={isSubmitting}
                  >
                    <span className={styles.avatar} aria-hidden>
                      {account.name[0]}
                    </span>
                    <span>
                      <span className={styles.demoName}>
                        {account.label} · {account.name}
                      </span>
                      <span className={styles.demoDescription}>{account.description}</span>
                    </span>
                    <Icon name="arrowRight" size={16} />
                  </button>
                ))}
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  )
}
