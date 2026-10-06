import type { ProductDto } from '@stock/shared'
import { useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../lib/api-client'
import { formatMoney } from '../../lib/format'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { SearchInput } from '../../shared/ui/Field'
import { Icon } from '../../shared/ui/Icon'
import { Page, PageHeader } from '../../shared/ui/Layout'
import { useToast } from '../../shared/ui/Toast'
import { lookupProduct, useProducts } from '../products/api'
import { cartTotal, cartUnits } from './cart'
import { CheckoutDialog } from './CheckoutDialog'
import styles from './PosPage.module.css'
import { useCart } from './useCart'

export function PosPage() {
  const [cart, dispatch] = useCart()
  const [search, setSearch] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const query = useDebouncedValue(search.trim(), 200)
  const products = useProducts({ q: query || undefined, pageSize: 24, sort: 'name' })

  const total = cartTotal(cart.lines)
  const units = cartUnits(cart.lines)
  const quantityInCart = (id: string) => cart.lines.find((line) => line.product.id === id)?.quantity ?? 0

  // Atajo: "/" enfoca el buscador desde cualquier lugar de la pantalla.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const add = (product: ProductDto) => {
    if (product.stock <= quantityInCart(product.id)) {
      toast.error(`No hay más stock de ${product.name}`)
      return
    }
    dispatch({ type: 'add', product })
  }

  /** Enter: los lectores de código de barras "tipean" el código y mandan Enter. */
  const onSearchEnter = async () => {
    const code = search.trim()
    if (!code) return
    const exact = products.data?.items.length === 1 && query === code ? products.data.items[0] : undefined
    try {
      add(exact ?? (await lookupProduct(code)))
      setSearch('')
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404 ? `No encontramos un producto con el código «${code}»` : errorMessage(error))
    }
  }

  return (
    <Page>
      <PageHeader title="Vender" subtitle="Escaneá o buscá productos y cobrá en segundos." />

      <div className={styles.layout}>
        <section className={styles.searchArea} aria-label="Catálogo">
          <SearchInput
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Nombre, código o código de barras"
            aria-label="Buscar producto"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void onSearchEnter()
              }
            }}
          />
          <p className={styles.searchHint}>
            <Icon name="scan" size={14} /> Con lector de código de barras: escaneá y se agrega solo. Atajo <kbd>/</kbd> para buscar.
          </p>

          {products.isPending ? (
            <LoadingState />
          ) : products.isError ? (
            <ErrorState error={products.error} onRetry={() => products.refetch()} />
          ) : products.data.items.length === 0 ? (
            <EmptyState icon="search" title="Sin resultados">
              Probá con otra palabra o con el código del producto.
            </EmptyState>
          ) : (
            <ul className={[styles.results, products.isPlaceholderData && styles.stale].filter(Boolean).join(' ')}>
              {products.data.items.map((product) => {
                const inCart = quantityInCart(product.id)
                const available = product.stock - inCart
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      className={styles.productButton}
                      onClick={() => add(product)}
                      disabled={available <= 0}
                      aria-label={`Agregar ${product.name}, ${formatMoney(product.priceCents)}`}
                    >
                      <span className={styles.productName}>{product.name}</span>
                      <span className={styles.productMeta}>
                        <span className={styles.price}>{formatMoney(product.priceCents)}</span>
                        {product.stock <= 0 ? (
                          <Badge tone="danger" icon="x">
                            Sin stock
                          </Badge>
                        ) : inCart > 0 ? (
                          <span className={styles.inCart}>{inCart} en carrito</span>
                        ) : (
                          <Badge tone={product.stock <= product.minStock ? 'warning' : 'neutral'}>{product.stock} u.</Badge>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className={[styles.cart, cart.lines.length === 0 && styles.cartEmpty].filter(Boolean).join(' ')} aria-label="Carrito">
          <header className={styles.cartHeader}>
            <span className={styles.cartTitle}>
              Carrito {units > 0 && <span className="tabular">({units})</span>}
            </span>
            {cart.lines.length > 0 && (
              <Button variant="ghost" size="sm" icon="trash" onClick={() => dispatch({ type: 'clear' })}>
                Vaciar
              </Button>
            )}
          </header>

          {cart.lines.length === 0 ? (
            <EmptyState icon="pos" title="El carrito está vacío">
              Tocá un producto o escaneá su código para agregarlo.
            </EmptyState>
          ) : (
            <ul className={styles.lines}>
              {cart.lines.map(({ product, quantity }) => (
                <li key={product.id} className={styles.line}>
                  <div>
                    <div className={styles.lineName}>{product.name}</div>
                    <div className={`${styles.lineUnit} tabular`}>{formatMoney(product.priceCents)} c/u</div>
                  </div>
                  <div className={styles.lineSubtotal}>{formatMoney(product.priceCents * quantity)}</div>
                  <div className={styles.lineActions}>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        aria-label={`Quitar una unidad de ${product.name}`}
                        onClick={() => dispatch({ type: 'setQuantity', productId: product.id, quantity: quantity - 1 })}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={product.stock}
                        value={quantity}
                        aria-label={`Cantidad de ${product.name}`}
                        onChange={(event) =>
                          dispatch({ type: 'setQuantity', productId: product.id, quantity: Number(event.target.value) || 1 })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Agregar una unidad de ${product.name}`}
                        disabled={quantity >= product.stock}
                        onClick={() => dispatch({ type: 'setQuantity', productId: product.id, quantity: quantity + 1 })}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="x"
                    iconOnly
                    onClick={() => dispatch({ type: 'remove', productId: product.id })}
                  >
                    {`Quitar ${product.name}`}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <footer className={styles.cartFooter}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={`${styles.totalValue} tabular`}>{formatMoney(total)}</span>
            </div>
            <Button variant="primary" size="lg" block icon="cash" disabled={cart.lines.length === 0} onClick={() => setCheckoutOpen(true)}>
              Cobrar
            </Button>
          </footer>
        </aside>
      </div>

      {cart.lines.length > 0 && (
        <div className={styles.mobileBar}>
          <span>
            <small>
              {units} {units === 1 ? 'unidad' : 'unidades'}
            </small>
            <strong>{formatMoney(total)}</strong>
          </span>
          <Button variant="primary" icon="cash" onClick={() => setCheckoutOpen(true)}>
            Cobrar
          </Button>
        </div>
      )}

      <CheckoutDialog
        open={checkoutOpen}
        cart={cart}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={(sale) => {
          setCheckoutOpen(false)
          dispatch({ type: 'clear' })
          toast.success(`Venta #${sale.number} registrada por ${formatMoney(sale.totalCents)}`)
          searchRef.current?.focus()
        }}
      />
    </Page>
  )
}
