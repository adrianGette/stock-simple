import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  SALE_SORTS,
  type SaleQuery,
  type SaleSort,
  type SortDirection,
} from '@stock/shared'
import { useState } from 'react'
import { formatDateTime, formatMoney } from '../../lib/format'
import { useQueryParams } from '../../shared/hooks/useQueryParams'
import { type RangePreset, RANGE_PRESETS, rangeFor } from '../../shared/lib/date-range'
import { Badge } from '../../shared/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Select } from '../../shared/ui/Field'
import { Card, Page, PageHeader, Toolbar } from '../../shared/ui/Layout'
import { Pagination } from '../../shared/ui/Pagination'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { SortableHeader } from '../../shared/ui/SortableHeader'
import { type SortOption, SortSelect } from '../../shared/ui/SortSelect'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { SaleDetailDialog } from './SaleDetailDialog'
import { useSales } from './api'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'VOIDED', label: 'Anuladas' },
] as const

/** Opciones del selector de orden en celular. "Número" no está: ordena igual que la fecha. */
const SORT_OPTIONS: SortOption<SaleSort>[] = [
  { sort: 'date', dir: 'desc', label: 'Más recientes' },
  { sort: 'date', dir: 'asc', label: 'Más antiguas' },
  { sort: 'total', dir: 'desc', label: 'Total: mayor a menor' },
  { sort: 'total', dir: 'asc', label: 'Total: menor a mayor' },
  { sort: 'items', dir: 'desc', label: 'Más productos' },
  { sort: 'items', dir: 'asc', label: 'Menos productos' },
  { sort: 'seller', dir: 'asc', label: 'Vendió (A a Z)' },
  { sort: 'seller', dir: 'desc', label: 'Vendió (Z a A)' },
]

const DEFAULT_PRESET: RangePreset = '7d'

/** Valida un parámetro de la URL contra una lista de valores posibles; si no está, usa el de respaldo. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback
}

export function SalesPage() {
  const user = useCurrentUser()
  const seesAll = user.can('sales:read-all')
  const [selected, setSelected] = useState<string | null>(null)

  const [params, update] = useQueryParams()
  const preset = oneOf(params.get('periodo'), RANGE_PRESETS.map((p) => p.value), DEFAULT_PRESET)
  const status = oneOf(params.get('estado'), ['ALL', 'COMPLETED', 'VOIDED'] as const, 'ALL') satisfies SaleQuery['status']
  const paymentMethod = PAYMENT_METHODS.find((method) => method === params.get('pago'))
  const sortParam = oneOf(params.get('orden'), SALE_SORTS, 'date')
  // Ordenar por quién vendió solo tiene sentido si se ven las ventas de todos.
  const sort: SaleSort = sortParam === 'seller' && !seesAll ? 'date' : sortParam
  // Por defecto, las más recientes primero: en la URL solo se escribe lo que difiere de eso.
  const dir: SortDirection = params.get('dir') === 'asc' ? 'asc' : 'desc'
  const page = Number(params.get('pagina') ?? 1)

  const changeSort = (nextSort: SaleSort, nextDir: SortDirection) =>
    update({ orden: nextSort === 'date' ? null : nextSort, dir: nextDir === 'desc' ? null : nextDir })
  const sortProps = { sort, dir, onSort: changeSort }

  const sales = useSales({ ...rangeFor(preset), status, paymentMethod, sort, dir, page, pageSize: 20 })

  return (
    <Page>
      <PageHeader title={seesAll ? 'Ventas' : 'Mis ventas'} subtitle={seesAll ? 'Todas las ventas del comercio.' : 'Las ventas que registraste vos.'} />

      <Toolbar>
        <Select
          aria-label="Período"
          value={preset}
          onChange={(event) => update({ periodo: event.target.value === DEFAULT_PRESET ? null : event.target.value })}
          style={{ width: 'auto' }}
        >
          {RANGE_PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Medio de pago"
          value={paymentMethod ?? ''}
          onChange={(event) => update({ pago: event.target.value || null })}
          style={{ width: 'auto' }}
        >
          <option value="">Todos los medios de pago</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => update({ estado: value === 'ALL' ? null : value })}
        />
        <SortSelect options={SORT_OPTIONS.filter((option) => option.sort !== 'seller' || seesAll)} {...sortProps} />
      </Toolbar>

      <Card flush>
        {sales.isPending ? (
          <LoadingState />
        ) : sales.isError ? (
          <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
        ) : sales.data.items.length === 0 ? (
          <EmptyState icon="receipt" title={paymentMethod ? `No hay ventas con ${PAYMENT_METHOD_LABELS[paymentMethod].toLowerCase()} en este período` : 'No hay ventas en este período'} />
        ) : (
          <>
            <table className={table.table} style={{ opacity: sales.isPlaceholderData ? 0.6 : 1 }}>
              <thead>
                <tr>
                  <SortableHeader column="number" label="Venta" {...sortProps} />
                  <SortableHeader column="date" label="Fecha" {...sortProps} />
                  {seesAll && <SortableHeader column="seller" label="Vendió" {...sortProps} />}
                  <th scope="col">Pago</th>
                  <SortableHeader column="items" label="Productos" className={table.num} {...sortProps} />
                  <SortableHeader column="total" label="Total" className={table.num} {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {sales.data.items.map((sale) => (
                  <tr key={sale.id} className={table.clickable} onClick={() => setSelected(sale.id)}>
                    <td className={table.full}>
                      <button
                        type="button"
                        className={`${table.rowLink} ${table.primaryCell}`}
                        style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(sale.id)
                        }}
                      >
                        #{sale.number}
                      </button>{' '}
                      {sale.status === 'VOIDED' && (
                        <Badge tone="danger" icon="undo">
                          Anulada
                        </Badge>
                      )}
                    </td>
                    <td data-label="Fecha" className="tabular">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    {seesAll && <td data-label="Vendió">{sale.user.name}</td>}
                    <td data-label="Pago">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</td>
                    <td data-label="Productos" className={table.num}>
                      {sale.itemCount}
                    </td>
                    <td data-label="Total" className={table.num} style={{ textDecoration: sale.status === 'VOIDED' ? 'line-through' : undefined }}>
                      {formatMoney(sale.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={sales.data.pageSize}
              total={sales.data.total}
              onChange={(next) => update({ pagina: String(next) })}
            />
          </>
        )}
      </Card>

      <SaleDetailDialog saleId={selected} onClose={() => setSelected(null)} />
    </Page>
  )
}
