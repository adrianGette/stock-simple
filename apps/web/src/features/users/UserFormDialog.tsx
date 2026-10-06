import { zodResolver } from '@hookform/resolvers/zod'
import { ROLE_LABELS, ROLES, type UserDto, createUserSchema } from '@stock/shared'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, errorMessage } from '../../lib/api-client'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Field, Input, Select } from '../../shared/ui/Field'
import { useToast } from '../../shared/ui/Toast'
import styles from '../products/products.module.css'
import { useSaveUser } from './api'

const ROLE_HINTS = {
  OWNER: 'Acceso total, incluida la gestión del equipo.',
  MANAGER: 'Productos, stock, precios, ventas y reportes.',
  CASHIER: 'Vende y consulta precios. No ve costos ni reportes.',
} as const

// En edición la contraseña es opcional: vacía = no se cambia.
const editSchema = z.object({
  name: createUserSchema.shape.name,
  role: createUserSchema.shape.role,
  active: z.boolean(),
  password: z.union([z.literal(''), createUserSchema.shape.password]),
})

type CreateValues = z.input<typeof createUserSchema>
type EditValues = z.input<typeof editSchema>

interface UserFormDialogProps {
  open: boolean
  onClose: () => void
  user?: UserDto
  isSelf?: boolean
}

export function UserFormDialog({ open, onClose, user, isSelf = false }: UserFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={user ? `Editar a ${user.name}` : 'Nuevo usuario'}>
      {open && (user ? <EditForm user={user} isSelf={isSelf} onDone={onClose} /> : <CreateForm onDone={onClose} />)}
    </Dialog>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const save = useSaveUser()
  const toast = useToast()
  const form = useForm<CreateValues>({
    resolver: zodResolver(createUserSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '', role: 'CASHIER' },
  })
  const { errors, isSubmitting } = form.formState
  const role = useWatch({ control: form.control, name: 'role' })

  const submit = form.handleSubmit(async (values) => {
    try {
      const created = await save.mutateAsync(values)
      toast.success(`${created.name} ya puede ingresar`)
      onDone()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') form.setError('email', { message: error.message })
      else form.setError('root', { message: errorMessage(error) })
    }
  })

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label="Nombre" error={errors.name?.message} className={styles.full}>
        <Input autoFocus autoComplete="off" {...form.register('name')} />
      </Field>
      <Field label="Email" error={errors.email?.message} className={styles.full}>
        <Input type="email" autoComplete="off" {...form.register('email')} />
      </Field>
      <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. Compartila por un medio seguro." error={errors.password?.message} className={styles.full}>
        <Input type="password" autoComplete="new-password" {...form.register('password')} />
      </Field>
      <Field label="Rol" hint={ROLE_HINTS[role]} error={errors.role?.message} className={styles.full}>
        <Select {...form.register('role')}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      {errors.root && (
        <p className={`${styles.full} ${styles.formError}`} role="alert">
          {errors.root.message}
        </p>
      )}
      <div className={`${styles.full} ${styles.formActions}`}>
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Crear usuario
        </Button>
      </div>
    </form>
  )
}

function EditForm({ user, isSelf, onDone }: { user: UserDto; isSelf: boolean; onDone: () => void }) {
  const save = useSaveUser(user.id)
  const toast = useToast()
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    mode: 'onTouched',
    defaultValues: { name: user.name, role: user.role, active: user.active, password: '' },
  })
  const { errors, isSubmitting } = form.formState
  const role = useWatch({ control: form.control, name: 'role' })

  const submit = form.handleSubmit(async ({ password, ...values }) => {
    try {
      // Solo enviamos lo que cambió.
      const changes = Object.fromEntries(
        Object.entries({ ...values, password: password || undefined }).filter(
          ([key, value]) => value !== undefined && value !== user[key as keyof UserDto],
        ),
      )
      if (Object.keys(changes).length === 0) return onDone()
      await save.mutateAsync(changes)
      toast.success('Cambios guardados')
      onDone()
    } catch (error) {
      form.setError('root', { message: errorMessage(error) })
    }
  })

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label="Nombre" error={errors.name?.message} className={styles.full}>
        <Input autoComplete="off" {...form.register('name')} />
      </Field>
      <Field
        label="Rol"
        hint={isSelf ? 'No podés cambiar tu propio rol.' : ROLE_HINTS[role]}
        error={errors.role?.message}
        className={styles.full}
      >
        <Select disabled={isSelf} {...form.register('role')}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nueva contraseña" optional hint="Dejala vacía para no cambiarla. Cierra sus sesiones abiertas." error={errors.password?.message} className={styles.full}>
        <Input type="password" autoComplete="new-password" {...form.register('password')} />
      </Field>
      {!isSelf && (
        <label className={styles.full} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" {...form.register('active')} /> Usuario activo (puede ingresar)
        </label>
      )}
      {errors.root && (
        <p className={`${styles.full} ${styles.formError}`} role="alert">
          {errors.root.message}
        </p>
      )}
      <div className={`${styles.full} ${styles.formActions}`}>
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
