import { PRODUCT_SORTS, type ProductSort, type SortDirection, marginPercent } from '@stock/shared'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatMoney, formatPercent } from '../../lib/format'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useDownload } from '../../shared/hooks/useDownload'
import { useQueryParams } from '../../shared/hooks/useQueryParams'
import { Button } from '../../shared/ui/Button'
import { EmptyState, ErrorState, TableSkeleton } from '../../shared/ui/Feedback'
import { SearchInput, Select } from '../../shared/ui/Field'
import { Card, Page, PageHeader, Toolbar, layoutStyles } from '../../shared/ui/Layout'
import { Pagination } from '../../shared/ui/Pagination'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { SortableHeader } from '../../shared/ui/SortableHeader'
import { type SortOption, SortSelect } from '../../shared/ui/SortSelect'
import table from '../../shared/ui/table.module.css'
import { useCurrentUser } from '../auth/AuthProvider'
import { CategoriesDialog } from './CategoriesDialog'
import { ImportProductsDialog } from './ImportProductsDialog'
import { InventoryCountDialog } from './InventoryCountDialog'
import { ProductFormDialog } from './ProductFormDialog'
import { StockBadge } from './StockBadge'
import { type ProductFilters, exportProducts, useCategories, useProducts } from './api'
import styles from './products.module.css'

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
] as const

/** Opciones del selector de orden en celular, donde la tabla se vuelve tarjetas y no hay encabezados. */
const SORT_OPTIONS: SortOption<ProductSort>[] = [
  { sort: 'name', dir: 'asc', label: 'Nombre (A a Z)' },
  { sort: 'name', dir: 'desc', label: 'Nombre (Z a A)' },
  { sort: 'category', dir: 'asc', label: 'Categoría (A a Z)' },
  { sort: 'category', dir: 'desc', label: 'Categoría (Z a A)' },
  { sort: 'price', dir: 'asc', label: 'Precio: menor a mayor' },
  { sort: 'price', dir: 'desc', label: 'Precio: mayor a menor' },
  { sort: 'margin', dir: 'asc', label: 'Margen: menor a mayor' },
  { sort: 'margin', dir: 'desc', label: 'Margen: mayor a menor' },
  { sort: 'stock', dir: 'asc', label: 'Stock: menor a mayor' },
  { sort: 'stock', dir: 'desc', label: 'Stock: mayor a menor' },
]

const isProductSort = (value: string | null): value is ProductSort => PRODUCT_SORTS.some((sort) => sort === value)

export function ProductsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const canWrite = user.can('products:write')
  const canSeeCost = user.can('products:view-cost')
  const [creating, setCreating] = useState(false)
  const [managingCategories, setManagingCategories] = useState(false)
  const [importing, setImporting] = useState(false)
  const [counting, setCounting] = useState(false)
  const canCount = user.can('stock:adjust')

  const [params, update] = useQueryParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(search.trim(), 300)
  const stock = (params.get('stock') ?? 'all') as ProductFilters['stock'] & string
  const categoryId = params.get('categoria') ?? ''
  const page = Number(params.get('pagina') ?? 1)
  // Un orden inválido en la URL (o por margen sin permiso de ver costos) vuelve al orden por nombre.
  const sortParam = params.get('orden')
  const sort: ProductSort = isProductSort(sortParam) && (sortParam !== 'margin' || canSeeCost) ? sortParam : 'name'
  const dir: SortDirection = params.get('dir') === 'desc' ? 'desc' : 'asc'

  // Los valores por defecto (nombre, ascendente) no se escriben en la URL, para que quede corta.
  const changeSort = (nextSort: ProductSort, nextDir: SortDirection) =>
    update({ orden: nextSort === 'name' ? null : nextSort, dir: nextDir === 'asc' ? null : nextDir })
  const sortProps = { sort, dir, onSort: changeSort }

  const filters: ProductFilters = { q: q || undefined, stock, categoryId: categoryId || undefined, sort, dir, page, pageSize: 25 }
  const products = useProducts(filters)
  const categories = useCategories()

  const exporting = useDownload()

  // Para el conteo: qué productos trae la planilla si hay filtros aplicados.
  const filtersLabel =
    [
      categoryId && `categoría ${categories.data?.find((category) => category.id === categoryId)?.name ?? ''}`.trim(),
      stock === 'low' && 'stock bajo',
      stock === 'out' && 'sin stock',
      q && `búsqueda «${q}»`,
    ]
      .filter(Boolean)
      .join(', ') || null

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
            <Button icon="download" loading={exporting.downloading} onClick={() => exporting.download(() => exportProducts(filters))}>
              Exportar
            </Button>
            {canCount && (
              <Button icon="clipboardCheck" onClick={() => setCounting(true)}>
                Conteo
              </Button>
            )}
            {canWrite && (
              <>
                <Button icon="upload" onClick={() => setImporting(true)}>
                  Importar
                </Button>
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
        <SortSelect options={SORT_OPTIONS.filter((option) => option.sort !== 'margin' || canSeeCost)} {...sortProps} />
      </Toolbar>

      <Card flush>
        {products.isPending ? (
          <TableSkeleton columns={5} />
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
                    <SortableHeader column="name" label="Producto" {...sortProps} />
                    <SortableHeader column="category" label="Categoría" {...sortProps} />
                    <SortableHeader column="price" label="Precio" className={table.num} {...sortProps} />
                    {canSeeCost && <SortableHeader column="margin" label="Margen" className={table.num} {...sortProps} />}
                    <SortableHeader column="stock" label="Stock" className={table.num} {...sortProps} />
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
      <ImportProductsDialog open={importing} onClose={() => setImporting(false)} />
      <InventoryCountDialog open={counting} onClose={() => setCounting(false)} filters={filters} filtersLabel={filtersLabel} />
    </Page>
  )
}
