import { ROLE_LABELS, type UserDto } from '@stock/shared'
import { useState } from 'react'
import { formatDateTime } from '../../lib/format'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { UserFormDialog } from './UserFormDialog'
import { useUsers } from './api'

export function UsersPage() {
  const me = useCurrentUser()
  const users = useUsers()
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null)

  return (
    <Page>
      <PageHeader
        title="Equipo"
        subtitle="Quién puede ingresar y qué puede hacer cada uno."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
            Nuevo usuario
          </Button>
        }
      />
      <Card flush>
        {users.isPending ? (
          <LoadingState />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : (
          <table className={table.table}>
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Último ingreso</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => (
                <tr key={user.id} style={{ opacity: user.active ? 1 : 0.6 }}>
                  <td className={table.full}>
                    <span className={table.primaryCell}>
                      {user.name} {user.id === me.id && <Badge>Vos</Badge>}
                    </span>
                    <span className={table.secondaryText}>{user.email}</span>
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
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(user)}>
                      Editar
                    </Button>
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
