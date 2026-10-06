import { useSyncExternalStore } from 'react'
import { serverStatusStore, waitForServer } from '../../lib/api-client'
import { Button } from './Button'
import { Icon } from './Icon'
import styles from './ServerStatusNotice.module.css'

/** Aviso mientras el servidor gratuito se despierta (o si no responde). */
export function ServerStatusNotice() {
  const status = useSyncExternalStore(serverStatusStore.subscribe, serverStatusStore.get)
  if (status !== 'waking' && status !== 'unreachable') return null

  return (
    <div className={styles.notice} role="status">
      {status === 'waking' ? (
        <>
          <span className={styles.spinner} aria-hidden />
          <span>
            <strong>Despertando el servidor…</strong> La demo usa un plan gratuito que se duerme sin uso; puede tardar hasta un
            minuto.
          </span>
        </>
      ) : (
        <>
          <Icon name="alert" size={16} />
          <span>
            <strong>El servidor no responde.</strong> Revisá tu conexión.
          </span>
          <Button size="sm" onClick={() => void waitForServer()}>
            Reintentar
          </Button>
        </>
      )}
    </div>
  )
}
