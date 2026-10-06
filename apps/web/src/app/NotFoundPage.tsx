import { useNavigate } from 'react-router'
import { Button } from '../shared/ui/Button'
import { EmptyState } from '../shared/ui/Feedback'
import { Page } from '../shared/ui/Layout'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Page>
      <EmptyState
        icon="search"
        title="Esta página no existe"
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Ir al inicio
          </Button>
        }
      >
        Puede que el enlace esté mal escrito o que ya no tengas acceso.
      </EmptyState>
    </Page>
  )
}
