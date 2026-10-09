import { ROLE_LABELS, type SortDirection, type UserDto } from '@stock/shared'
import { useMemo, useState } from 'react'
import { formatDateTime } from '../../lib/format'
import { Avatar } from '../../shared/ui/Avatar'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { ErrorState, TableSkeleton } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { useQueryParams } from '../../shared/hooks/useQueryParams'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import { SortableHeader } from '../../shared/ui/SortableHeader'
import { type SortOption, SortSelect } from '../../shared/ui/SortSelect'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { UserFormDialog } from './UserFormDialog'
import { useUsers } from './api'
import { USER_SORTS, type UserSort, sortUsers } from './sort-users'
import styles from './UsersPage.module.css'

const SORT_OPTIONS: SortOption<UserSort>[] = [
  { sort: 'status', dir: 'asc', label: 'Activos primero' },
  { sort: 'name', dir: 'asc', label: 'Nombre (A a Z)' },
  { sort: 'name', dir: 'desc', label: 'Nombre (Z a A)' },
  { sort: 'role', dir: 'asc', label: 'Rol: de dueño/a a cajero/a' },
  { sort: 'role', dir: 'desc', label: 'Rol: de cajero/a a dueño/a' },
  { sort: 'lastLogin', dir: 'desc', label: 'Ingreso más reciente' },
  { sort: 'lastLogin', dir: 'asc', label: 'Ingreso más antiguo' },
]

export function UsersPage() {
  const me = useCurrentUser()
  const users = useUsers()
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null)

  // Por defecto, activos primero y por nombre (el orden de siempre). En la URL solo va lo que difiere.
  const [params, update] = useQueryParams()
  const sort: UserSort = USER_SORTS.find((option) => option === params.get('orden')) ?? 'status'
  const dir: SortDirection = params.get('dir') === 'desc' ? 'desc' : 'asc'
  const sortProps = {
    sort,
    dir,
    onSort: (nextSort: UserSort, nextDir: SortDirection) =>
      update({ orden: nextSort === 'status' ? null : nextSort, dir: nextDir === 'asc' ? null : nextDir }),
  }
  const sorted = useMemo(() => (users.data ? sortUsers(users.data, sort, dir) : []), [users.data, sort, dir])

  return (
    <Page>
      <PageHeader
        title="Equipo"
        subtitle="Quién puede ingresar y qué puede hacer cada uno."
        actions={
          !me.demoMode && (
            <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
              Nuevo usuario
            </Button>
          )
        }
      />
      {me.demoMode && (
        <p className={styles.demoNotice} role="note">
          <Icon name="info" size={18} />
          <span>
            <strong>Modo demo.</strong> Estas cuentas las comparten todos los visitantes, así que no se pueden crear ni
            modificar usuarios: si alguien cambiara una contraseña, nadie más podría entrar. En una instalación real, la dueña
            administra el equipo desde acá.
          </span>
        </p>
      )}
      <SortSelect options={SORT_OPTIONS} {...sortProps} />
      <Card flush>
        {users.isPending ? (
          <TableSkeleton rows={4} columns={4} />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : (
          <table className={table.table}>
            <thead>
              <tr>
                <SortableHeader column="name" label="Persona" {...sortProps} />
                <SortableHeader column="role" label="Rol" {...sortProps} />
                <SortableHeader column="status" label="Estado" {...sortProps} />
                <SortableHeader column="lastLogin" label="Último ingreso" {...sortProps} />
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((user) => (
                <tr key={user.id} style={{ opacity: user.active ? 1 : 0.6 }}>
                  <td className={table.full}>
                    <span className={table.person}>
                      <Avatar name={user.name} seed={user.id} />
                      <span>
                        <span className={table.primaryCell}>
                          {user.name} {user.id === me.id && <Badge>Vos</Badge>}
                        </span>
                        <span className={table.secondaryText}>{user.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Rol">{ROLE_LABELS[user.role]}</td>
                  <td data-label="Estado">
                    {user.active ? (
                      <Badge tone="success" icon="check">
                        Activo
                      </Badge>
                    ) : (
                      <Badge icon="x">Inactivo</Badge>
                    )}
                  </td>
                  <td data-label="Último ingreso" className="tabular">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'}
                  </td>
                  <td>
                    {!me.demoMode && (
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(user)}>
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <UserFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        user={editing === 'new' || editing === null ? undefined : editing}
        isSelf={editing !== null && editing !== 'new' && editing.id === me.id}
      />
    </Page>
  )
}
