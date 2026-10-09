import { categoryInputSchema } from '@stock/shared'
import { type FormEvent, useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { LoadingState } from '../../shared/ui/Feedback'
import { Field, Input } from '../../shared/ui/Field'
import { useToast } from '../../shared/ui/Toast'
import { useCategories, useDeleteCategory, useSaveCategory } from './api'
import styles from './products.module.css'

export function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useCategories()
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string>()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const parsed = categoryInputSchema.safeParse({ name: newName })
    if (!parsed.success) return setNewError(parsed.error.issues[0]?.message)
    try {
      await save.mutateAsync(parsed.data)
      setNewName('')
      setNewError(undefined)
    } catch (error) {
      setNewError(errorMessage(error))
    }
  }

  const rename = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    try {
      await save.mutateAsync(editing)
      setEditing(null)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Categorías" description="Agrupan productos para filtrar, reportar y actualizar precios." icon="layers">
      <form onSubmit={create} className={styles.inlineForm} noValidate>
        <Field label="Nueva categoría" error={newError}>
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej. Longboards" />
        </Field>
        <Button type="submit" variant="primary" icon="plus" loading={save.isPending && !editing} style={{ alignSelf: 'end' }}>
          Agregar
        </Button>
      </form>

      {categories.isPending ? (
        <LoadingState />
      ) : (
        <ul className={styles.categoryList} style={{ marginTop: 'var(--space-4)' }}>
          {categories.data?.map((category) => (
            <li key={category.id} className={styles.categoryRow}>
              {editing?.id === category.id ? (
                <form onSubmit={rename} className={styles.inlineForm}>
                  <Input
                    aria-label={`Nuevo nombre para ${category.name}`}
                    autoFocus
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                  <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <span className={styles.categoryName}>
                    {category.name}{' '}
                    <span className={styles.categoryCount}>
                      · {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" icon="edit" iconOnly onClick={() => setEditing({ id: category.id, name: category.name })}>
                    {`Renombrar ${category.name}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    iconOnly
                    disabled={category.productCount > 0 || remove.isPending}
                    title={category.productCount > 0 ? 'Solo se pueden eliminar categorías vacías' : undefined}
                    onClick={() =>
                      remove.mutate(category.id, {
                        onSuccess: () => toast.success(`Categoría ${category.name} eliminada`),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  >
                    {`Eliminar ${category.name}`}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
