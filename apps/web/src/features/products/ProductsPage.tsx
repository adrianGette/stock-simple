import { marginPercent } from '@stock/shared'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../../lib/api-client'
import { formatMoney, formatPercent } from '../../lib/format'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { SearchInput, Select } from '../../shared/ui/Field'
import { Card, Page, PageHeader, Toolbar, layoutStyles } from '../../shared/ui/Layout'
import { Pagination } from '../../shared/ui/Pagination'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { useToast } from '../../shared/ui/Toast'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { CategoriesDialog } from './CategoriesDialog'
import { ProductFormDialog } from './ProductFormDialog'
import { StockBadge } from './StockBadge'
import { type ProductFilters, exportProducts, useCategories, useProducts } from './api'
import styles from './products.module.css'

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
] as const

export function ProductsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const canWrite = user.can('products:write')
  const canSeeCost = user.can('products:view-cost')
  const [creating, setCreating] = useState(false)
  const [managingCategories, setManagingCategories] = useState(false)

  // Los filtros viven en la URL: se pueden compartir, recargar y volver atrás sin perderlos.
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(search.trim(), 300)
  const stock = (params.get('stock') ?? 'all') as ProductFilters['stock'] & string
  const categoryId = params.get('categoria') ?? ''
  const page = Number(params.get('pagina') ?? 1)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('pagina' in changes)) next.delete('pagina')
        return next
      },
      { replace: true },
    )

  const filters: ProductFilters = { q: q || undefined, stock, categoryId: categoryId || undefined, page, pageSize: 25 }
  const products = useProducts(filters)
  const categories = useCategories()

  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  async function handleExport() {
    setExporting(true)
    try {
      await exportProducts(filters)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  // La búsqueda se escribe en la URL con debounce, para no generar una entrada de historial por tecla.
  const urlQuery = params.get('q') ?? ''
  useEffect(() => {
    if (q !== urlQuery) update({ q: q || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el texto buscado
  }, [q])

  return (
    <Page>
      <PageHeader
        title="Productos"
        subtitle="Catálogo, precios y existencias."
        actions={
          <>
            <Button icon="download" loading={exporting} onClick={handleExport}>
              Exportar
            </Button>
            {canWrite && (
              <>
                <Button icon="layers" onClick={() => setManagingCategories(true)}>
                  Categorías
                </Button>
                <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                  Nuevo producto
                </Button>
              </>
            )}
          </>
        }
      />

      <Toolbar>
        <SearchInput
          className={layoutStyles.grow}
          placeholder="Buscar por nombre, código o código de barras"
          aria-label="Buscar productos"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Categoría"
          value={categoryId}
          onChange={(event) => update({ categoria: event.target.value || null })}
          style={{ width: 'auto' }}
        >
          <option value="">Todas las categorías</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Filtrar por stock"
          value={stock}
          options={STOCK_FILTERS}
          onChange={(value) => update({ stock: value === 'all' ? null : value })}
        />
      </Toolbar>

      <Card flush>
        {products.isPending ? (
          <LoadingState />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : products.data.items.length === 0 ? (
          <EmptyState title="No hay productos para mostrar">
            {q || stock !== 'all' || categoryId ? 'Probá cambiando los filtros.' : 'Cargá tu primer producto para empezar.'}
          </EmptyState>
        ) : (
          <>
            <div className={table.wrap} style={{ opacity: products.isPlaceholderData ? 0.6 : 1 }}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Categoría</th>
                    <th scope="col" className={table.num}>
                      Precio
                    </th>
                    {canSeeCost && (
                      <th scope="col" className={table.num}>
                        Margen
                      </th>
                    )}
                    <th scope="col" className={table.num}>
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.data.items.map((product) => {
                    const margin = product.costCents !== undefined ? marginPercent(product.costCents, product.priceCents) : null
                    return (
                      <tr key={product.id} className={table.clickable} onClick={() => navigate(`/productos/${product.id}`)}>
                        <td className={table.full}>
                          <Link to={`/productos/${product.id}`} className={`${table.rowLink} ${table.primaryCell}`}>
                            {product.name}
                          </Link>
                          <span className={`${table.secondaryText} mono`}>{product.sku}</span>
                        </td>
                        <td data-label="Categoría">{product.category?.name ?? '—'}</td>
                        <td data-label="Precio" className={table.num}>
                          {formatMoney(product.priceCents)}
                        </td>
                        {canSeeCost && (
                          <td data-label="Margen" className={table.num}>
                            {margin === null ? '—' : formatPercent(margin)}
                          </td>
                        )}
                        <td data-label="Stock" className={table.num}>
                          <span className={styles.stockCell}>
                            <StockBadge stock={product.stock} minStock={product.minStock} />
                            {product.stock}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={products.data.page}
              pageSize={products.data.pageSize}
              total={products.data.total}
              onChange={(next) => update({ pagina: String(next) })}
            />
          </>
        )}
      </Card>

      <ProductFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/productos/${p.id}`)} />
      <CategoriesDialog open={managingCategories} onClose={() => setManagingCategories(false)} />
    </Page>
  )
}
