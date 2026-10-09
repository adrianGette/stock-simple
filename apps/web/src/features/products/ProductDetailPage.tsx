import { STOCK_MOVEMENT_LABELS, marginPercent } from '@stock/shared'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { formatDateTime, formatMoney, formatPercent } from '../../lib/format'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { CopyButton } from '../../shared/ui/CopyButton'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import { Pagination } from '../../shared/ui/Pagination'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { StatTile } from '../../shared/ui/StatTile'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { ProductFormDialog } from './ProductFormDialog'
import { StockAdjustDialog } from './StockAdjustDialog'
import { StockBadge } from './StockBadge'
import { useMovements, usePriceHistory, useProduct } from './api'
import styles from './products.module.css'


const PRICE_REASONS = { MANUAL: 'Edición manual', BULK: 'Actualización masiva', PURCHASE: 'Ingreso de mercadería' } as const

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const user = useCurrentUser()
  const product = useProduct(id)
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [tab, setTab] = useState<'movements' | 'prices'>(user.can('stock:adjust') ? 'movements' : 'prices')

  if (product.isPending) return <LoadingState />
  if (product.isError) return <ErrorState error={product.error} onRetry={() => product.refetch()} />

  const p = product.data
  const margin = p.costCents !== undefined ? marginPercent(p.costCents, p.priceCents) : null
  const tabs = [
    ...(user.can('stock:adjust') ? [{ value: 'movements' as const, label: 'Movimientos de stock' }] : []),
    ...(user.can('products:view-cost') ? [{ value: 'prices' as const, label: 'Historial de precios' }] : []),
  ]

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link to="/productos" className={styles.backLink}>
            <Icon name="chevronLeft" size={14} /> Productos
          </Link>
        }
        title={p.name}
        meta={
          // Cada dato con su nombre: quien recién empieza no tiene por qué saber qué es "ACC-08" o un número de 13 cifras.
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>
                <Icon name="tag" size={14} /> SKU
              </dt>
              <dd>
                <span className="mono">{p.sku}</span>
                <CopyButton value={p.sku} label="SKU" />
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name="scan" size={14} /> Código de barras
              </dt>
              <dd>
                {p.barcode ? (
                  <>
                    <span className="mono">{p.barcode}</span>
                    <CopyButton value={p.barcode} label="código de barras" />
                  </>
                ) : (
                  <span className={styles.factEmpty}>Sin cargar</span>
                )}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name="layers" size={14} /> Categoría
              </dt>
              <dd>
                {p.category ? (
                  <Link to={`/productos?categoria=${p.category.id}`} className={styles.factLink} title={`Ver los productos de ${p.category.name}`}>
                    {p.category.name}
                  </Link>
                ) : (
                  <span className={styles.factEmpty}>Sin categoría</span>
                )}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name="info" size={14} /> Estado
              </dt>
              <dd>
                {p.active ? (
                  <StockBadge stock={p.stock} minStock={p.minStock} verbose />
                ) : (
                  <Badge>Dado de baja</Badge>
                )}
              </dd>
            </div>
          </dl>
        }
        actions={
          <>
            {user.can('stock:adjust') && (
              <Button icon="layers" onClick={() => setAdjusting(true)}>
                Ajustar stock
              </Button>
            )}
            {user.can('products:write') && (
              <Button variant="primary" icon="edit" onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
          </>
        }
      />

      <div className={styles.stats}>
        <StatTile label="Precio de venta" value={formatMoney(p.priceCents)} />
        {p.costCents !== undefined && <StatTile label="Costo" value={formatMoney(p.costCents)} />}
        {margin !== null && <StatTile label="Margen" value={formatPercent(margin)} />}
        <StatTile label="Stock" value={`${p.stock} u.`} hint={`Mínimo: ${p.minStock} u.`} />
      </div>

      {tabs.length > 0 && (
        <Card
          flush
          title={tabs.length === 1 ? tabs[0]!.label : undefined}
          action={tabs.length > 1 && <SegmentedControl label="Historial" value={tab} options={tabs} onChange={setTab} />}
        >
          {tab === 'movements' ? <MovementsTable productId={p.id} /> : <PriceHistoryTable productId={p.id} />}
        </Card>
      )}

      <ProductFormDialog open={editing} onClose={() => setEditing(false)} product={p} />
      <StockAdjustDialog open={adjusting} onClose={() => setAdjusting(false)} product={p} />
    </Page>
  )
}

function MovementsTable({ productId }: { productId: string }) {
  const [page, setPage] = useState(1)
  const movements = useMovements(productId, page)
  if (movements.isPending) return <LoadingState />
  if (movements.isError) return <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
  if (movements.data.items.length === 0) return <EmptyState icon="layers" title="Sin movimientos todavía" />

  return (
    <>
      <table className={table.table}>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Movimiento</th>
            <th scope="col">Usuario</th>
            <th scope="col" className={table.num}>
              Cantidad
            </th>
            <th scope="col" className={table.num}>
              Stock
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.data.items.map((m) => (
            <tr key={m.id}>
              <td data-label="Fecha" className="tabular">
                {formatDateTime(m.createdAt)}
              </td>
              <td data-label="Movimiento">
                {STOCK_MOVEMENT_LABELS[m.type]}
                {m.saleNumber && ` #${m.saleNumber}`}
                {m.note && <span className={table.secondaryText}>{m.note}</span>}
              </td>
              <td data-label="Usuario">{m.user.name}</td>
              <td data-label="Cantidad" className={table.num}>
                <span className={m.quantity > 0 ? styles.positive : m.quantity < 0 ? styles.negative : undefined}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
              </td>
              <td data-label="Stock" className={table.num}>
                {m.stockAfter}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} pageSize={movements.data.pageSize} total={movements.data.total} onChange={setPage} />
    </>
  )
}

function PriceHistoryTable({ productId }: { productId: string }) {
  const history = usePriceHistory(productId)
  if (history.isPending) return <LoadingState />
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />
  if (history.data.length === 0) return <EmptyState icon="tag" title="El precio no cambió desde que se cargó el producto" />

  return (
    <table className={table.table}>
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Motivo</th>
          <th scope="col" className={table.num}>
            Precio
          </th>
          <th scope="col" className={table.num}>
            Costo
          </th>
        </tr>
      </thead>
      <tbody>
        {history.data.map((change) => (
          <tr key={change.id}>
            <td data-label="Fecha" className="tabular">
              {formatDateTime(change.createdAt)}
              <span className={table.secondaryText}>{change.user.name}</span>
            </td>
            <td data-label="Motivo">{PRICE_REASONS[change.reason]}</td>
            <td data-label="Precio" className={table.num}>
              <PriceChange from={change.oldPriceCents} to={change.newPriceCents} />
            </td>
            <td data-label="Costo" className={table.num}>
              <PriceChange from={change.oldCostCents} to={change.newCostCents} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PriceChange({ from, to }: { from: number; to: number }) {
  if (from === to) return <span style={{ color: 'var(--color-muted)' }}>{formatMoney(to)}</span>
  const percent = ((to - from) / from) * 100
  return (
    <span>
      {formatMoney(to)}
      <span className={table.secondaryText}>
        antes {formatMoney(from)} · {percent > 0 ? '+' : ''}
        {formatPercent(percent)}
      </span>
    </span>
  )
}
