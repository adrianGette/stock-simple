import { formatInteger } from '../../lib/format'
import { Button } from './Button'
import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className={styles.pagination} aria-label="Paginación">
      <span className="tabular">
        {formatInteger(from)}–{formatInteger(to)} de {formatInteger(total)}
      </span>
      <div className={styles.buttons}>
        <Button size="sm" variant="ghost" icon="chevronLeft" iconOnly disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Página anterior
        </Button>
        <Button size="sm" variant="ghost" icon="chevronRight" iconOnly disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Página siguiente
        </Button>
      </div>
    </nav>
  )
}
