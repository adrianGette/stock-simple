import type { SortDirection } from '@stock/shared'
import { Select } from './Field'
import table from './table.module.css'

export interface SortOption<S extends string> {
  sort: S
  dir: SortDirection
  label: string
}

interface SortSelectProps<S extends string> {
  options: SortOption<S>[]
  sort: S
  dir: SortDirection
  onSort: (sort: S, dir: SortDirection) => void
}

/**
 * Selector de orden para celular: ahí la tabla se vuelve tarjetas, los encabezados (SortableHeader)
 * no se ven y este selector ocupa su lugar. En pantallas anchas queda oculto.
 */
export function SortSelect<S extends string>({ options, sort, dir, onSort }: SortSelectProps<S>) {
  return (
    <Select
      aria-label="Ordenar por"
      className={table.sortSelect}
      value={`${sort}:${dir}`}
      onChange={(event) => {
        const [nextSort, nextDir] = event.target.value.split(':') as [S, SortDirection]
        onSort(nextSort, nextDir)
      }}
    >
      {options.map((option) => (
        <option key={`${option.sort}:${option.dir}`} value={`${option.sort}:${option.dir}`}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}
