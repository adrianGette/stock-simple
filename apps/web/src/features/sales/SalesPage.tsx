import { PAYMENT_METHOD_LABELS, type SaleQuery } from '@stock/shared'
import { useState } from 'react'
import { formatDateTime, formatMoney } from '../../lib/format'
import { type RangePreset, RANGE_PRESETS, rangeFor } from '../../shared/lib/date-range'
import { Badge } from '../../shared/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Select } from '../../shared/ui/Field'
import { Card, Page, PageHeader, Toolbar } from '../../shared/ui/Layout'
import { Pagination } from '../../shared/ui/Pagination'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { SaleDetailDialog } from './SaleDetailDialog'
import { useSales } from './api'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'VOIDED', label: 'Anuladas' },
] as const

export function SalesPage() {
  const user = useCurrentUser()
  const seesAll = user.can('sales:read-all')
  const [preset, setPreset] = useState<RangePreset>('7d')
  const [status, setStatus] = useState<SaleQuery['status']>('ALL')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const sales = useSales({ ...rangeFor(preset), status, page, pageSize: 20 })

  return (
    <Page>
      <PageHeader title={seesAll ? 'Ventas' : 'Mis ventas'} subtitle={seesAll ? 'Todas las ventas del comercio.' : 'Las ventas que registraste vos.'} />

      <Toolbar>
        <Select
          aria-label="Período"
          value={preset}
          onChange={(event) => {
            setPreset(event.target.value as RangePreset)
            setPage(1)
          }}
          style={{ width: 'auto' }}
        >
          {RANGE_PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
      </Toolbar>

      <Card flush>
        {sales.isPending ? (
          <LoadingState />
        ) : sales.isError ? (
          <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
        ) : sales.data.items.length === 0 ? (
          <EmptyState icon="receipt" title="No hay ventas en este período" />
        ) : (
          <>
            <table className={table.table} style={{ opacity: sales.isPlaceholderData ? 0.6 : 1 }}>
              <thead>
                <tr>
                  <th scope="col">Venta</th>
                  <th scope="col">Fecha</th>
                  {seesAll && <th scope="col">Vendió</th>}
                  <th scope="col">Pago</th>
                  <th scope="col" className={table.num}>
                    Productos
                  </th>
                  <th scope="col" className={table.num}>
                    Total
                  </th>
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
            <Pagination page={page} pageSize={sales.data.pageSize} total={sales.data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <SaleDetailDialog saleId={selected} onClose={() => setSelected(null)} />
    </Page>
  )
}
