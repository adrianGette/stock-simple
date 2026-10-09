import type { SortDirection } from '@stock/shared'
import { Icon } from './Icon'
import table from './table.module.css'

interface SortableHeaderProps<S extends string> {
  column: S
  label: string
  sort: S
  dir: SortDirection
  onSort: (column: S, dir: SortDirection) => void
  className?: string
}

/**
 * Encabezado de tabla que ordena por su columna: el primer click ordena ascendente y el siguiente
 * invierte. Es un <button> dentro del <th> (se puede usar con teclado) y `aria-sort` le dice al
 * lector de pantalla qué columna ordena la tabla y en qué dirección.
 */
export function SortableHeader<S extends string>({ column, label, sort, dir, onSort, className }: SortableHeaderProps<S>) {
  const active = sort === column
  return (
    <th
      scope="col"
      className={[className, active && table.sorted].filter(Boolean).join(' ')}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" className={table.sortButton} onClick={() => onSort(column, active && dir === 'asc' ? 'desc' : 'asc')}>
        {label}
        <Icon name={active ? (dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronsUpDown'} size={14} className={table.sortIcon} />
      </button>
    </th>
  )
}
