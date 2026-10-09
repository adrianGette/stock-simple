import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api, errorMessage, refreshSession } from '../../lib/api-client'
import { blobToDataUrl } from '../../shared/lib/blob-to-data-url'
import { toSquarePhoto } from '../../shared/lib/resize-image'
import { Avatar } from '../../shared/ui/Avatar'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Icon } from '../../shared/ui/Icon'
import { useToast } from '../../shared/ui/Toast'
import { useCurrentUser } from '../auth/AuthProvider'
import styles from './ProfilePhotoDialog.module.css'

/** Cada persona cambia o quita su propia foto. En la demo pública está bloqueado. */
export function ProfilePhotoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentUser()
  const toast = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setPhoto(null)
    setPreview(null)
    setProblem(null)
    onClose()
  }

  async function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setProblem(null)
    try {
      const prepared = await toSquarePhoto(file)
      setPhoto(prepared)
      setPreview(await blobToDataUrl(prepared))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'No pudimos leer esa imagen.')
    }
  }

  async function save(action: () => Promise<unknown>, message: string) {
    setSaving(true)
    try {
      await action()
      // La sesión trae la versión nueva de la foto; el equipo y las ventas también la muestran.
      await refreshSession()
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['users'] }), queryClient.invalidateQueries({ queryKey: ['sales'] })])
      toast.success(message)
      close()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!saving}
      title="Foto de perfil"
      description="Se ve en tu tarjeta, en Equipo y en las ventas que registrás."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!photo}
            loading={saving && Boolean(photo)}
            onClick={() => photo && save(() => api('/users/me/photo', { method: 'PUT', body: photo }), 'Foto actualizada')}
          >
            Guardar foto
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <Avatar name={me.name} userId={me.id} photoVersion={me.photoVersion} photoUrl={preview} size="xl" />
        {me.demoMode ? (
          <p className={styles.note} role="note">
            <Icon name="info" size={16} />
            En la demo no se pueden subir fotos: las cuentas son compartidas y cualquier visitante las vería.
          </p>
        ) : (
          <>
            <div className={styles.actions}>
              <Button icon="upload" onClick={() => inputRef.current?.click()} disabled={saving}>
                {me.photoVersion || photo ? 'Elegir otra foto' : 'Elegir foto'}
              </Button>
              {me.photoVersion && !photo && (
                <Button
                  variant="ghost"
                  icon="trash"
                  loading={saving}
                  onClick={() => save(() => api('/users/me/photo', { method: 'DELETE' }), 'Foto quitada')}
                >
                  Quitar foto
                </Button>
              )}
            </div>
            <p className={styles.hint}>La recortamos en cuadrado y la achicamos antes de subirla.</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </>
        )}
        {problem && (
          <p className={styles.error} role="alert">
            {problem}
          </p>
        )}
      </div>
    </Dialog>
  )
}
