import type { Paginated, ProductDto } from '@stock/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../lib/api-client'
import { formatMoney } from '../../lib/format'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Icon, type IconName } from '../../shared/ui/Icon'
import type { NavItem } from '../navigation'
import styles from './CommandPalette.module.css'

interface Result {
  id: string
  icon: IconName
  label: string
  hint?: string
  group: 'Ir a' | 'Acciones' | 'Productos'
  run: () => void
}

/** Para buscar como escribe la gente: sin mayúsculas ni acentos ("precios" encuentra "Precios"). */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Buscador rápido (Ctrl + K / Cmd + K): secciones, acciones y productos desde cualquier pantalla,
 * todo con el teclado. Es un <dialog> nativo: foco atrapado y Esc sin código propio.
 */
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: NavItem[] }) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const q = useDebouncedValue(query.trim(), 200)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      setActive(0)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Clic en el fondo (fuera del cuadro) cierra, como en el resto de los diálogos.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onClick = (event: MouseEvent) => event.target === dialog && onClose()
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [onClose])

  const products = useQuery({
    queryKey: ['products', 'palette', q],
    queryFn: ({ signal }) => api<Paginated<ProductDto>>('/products', { query: { q, pageSize: 6 }, signal }),
    enabled: open && q.length >= 2,
  })

  const go = (to: string) => () => {
    onClose()
    navigate(to)
  }
  const match = (label: string) => !query.trim() || normalize(label).includes(normalize(query))

  const results: Result[] = [
    ...items
      .filter((item) => match(item.label))
      .map((item): Result => ({ id: item.to, icon: item.icon, label: item.label, group: 'Ir a', run: go(item.to) })),
    ...(items.some((item) => item.to === '/vender') && match('Nueva venta')
      ? [{ id: 'new-sale', icon: 'plus' as const, label: 'Nueva venta', group: 'Acciones' as const, run: go('/vender') }]
      : []),
    ...(q.length >= 2 && products.data
      ? products.data.items.map(
          (product): Result => ({
            id: product.id,
            icon: 'box',
            label: product.name,
            hint: `${product.sku} · ${formatMoney(product.priceCents)}`,
            group: 'Productos',
            run: go(`/productos/${product.id}`),
          }),
        )
      : []),
  ]
  const current = Math.min(active, Math.max(results.length - 1, 0))

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[current]?.run()
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.palette} aria-label="Buscador rápido" onClose={onClose}>
      {open && (
        <>
          <div className={styles.inputRow}>
            <Icon name="search" size={18} />
            <input
              autoFocus
              className={styles.input}
              placeholder="Buscá una sección, una acción o un producto…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
            />
            <kbd className={styles.kbd}>Esc</kbd>
          </div>
          <div id={listId} className={styles.list} role="listbox" aria-label="Resultados">
            {results.map((result, index) => (
              <div key={result.id} role="presentation">
                {(index === 0 || results[index - 1]?.group !== result.group) && (
                  <span className={styles.groupTitle} role="presentation">
                    {result.group}
                  </span>
                )}
                {/* El foco queda en el campo de texto (aria-activedescendant); el clic es un atajo para el mouse. */}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === current}
                  className={styles.option}
                  onMouseMove={() => setActive(index)}
                  onClick={result.run}
                  onKeyDown={(event) => event.key === 'Enter' && result.run()}
                >
                  <span className={styles.optionIcon}>
                    <Icon name={result.icon} size={16} />
                  </span>
                  <span className={styles.optionLabel}>{result.label}</span>
                  {result.hint && <span className={`${styles.optionHint} mono`}>{result.hint}</span>}
                </div>
              </div>
            ))}
            {results.length === 0 && (
              <p className={styles.empty} role="status">
                {products.isFetching ? 'Buscando…' : `Nada coincide con «${query.trim()}».`}
              </p>
            )}
          </div>
          <div className={styles.footer}>
            <span>
              <kbd className={styles.kbd}>↑</kbd> <kbd className={styles.kbd}>↓</kbd> para moverte
            </span>
            <span>
              <kbd className={styles.kbd}>Enter</kbd> para abrir
            </span>
          </div>
        </>
      )}
    </dialog>
  )
}
