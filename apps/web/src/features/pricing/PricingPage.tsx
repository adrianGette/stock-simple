import {
  type BulkPriceUpdateInput,
  type PriceTarget,
  ROUNDING_LABELS,
  ROUNDING_STEPS,
  type RoundingDirection,
  type RoundingStep,
  adjustAmount,
} from '@stock/shared'
import { useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { formatMoney, formatPercent } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { EmptyState, LoadingState } from '../../shared/ui/Feedback'
import { Field, Input, Select } from '../../shared/ui/Field'
import { Icon } from '../../shared/ui/Icon'
import { Card, Page, PageHeader } from '../../shared/ui/Layout'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import table from '../../shared/ui/table.module.css'
import { useToast } from '../../shared/ui/Toast'
import { useCategories } from '../products/api'
import { useApplyPrices, usePricePreview } from './api'
import styles from './PricingPage.module.css'

const TARGETS = [
  { value: 'price', label: 'Precio' },
  { value: 'cost', label: 'Costo' },
  { value: 'both', label: 'Ambos' },
] as const

const DIRECTIONS = [
  { value: 'up', label: 'Hacia arriba' },
  { value: 'nearest', label: 'Al más cercano' },
] as const

const EXAMPLE_PRICE = 3_490_000

export function PricingPage() {
  const categories = useCategories()
  const preview = usePricePreview()
  const apply = useApplyPrices()
  const toast = useToast()

  const [categoryId, setCategoryId] = useState('')
  const [target, setTarget] = useState<PriceTarget>('price')
  const [percentText, setPercentText] = useState('')
  const [roundTo, setRoundTo] = useState<RoundingStep>(1000)
  const [direction, setDirection] = useState<RoundingDirection>('up')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [previewedWith, setPreviewedWith] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [formError, setFormError] = useState<string>()

  const percent = Number(percentText.replace(',', '.'))
  const validPercent = percentText.trim() !== '' && Number.isFinite(percent) && percent !== 0
  const params: BulkPriceUpdateInput = { categoryId: categoryId || null, target, percent, roundTo, direction }
  const paramsKey = JSON.stringify(params)
  const isStale = previewedWith !== null && previewedWith !== paramsKey

  const rows = preview.data?.rows ?? []
  const selectedIds = rows.filter((row) => !excluded.has(row.productId)).map((row) => row.productId)

  const runPreview = () => {
    if (!validPercent) return setFormError('Ingresá un porcentaje distinto de 0')
    setFormError(undefined)
    preview.mutate(params, {
      onSuccess: () => {
        setExcluded(new Set())
        setPreviewedWith(paramsKey)
      },
      onError: (error) => setFormError(errorMessage(error)),
    })
  }

  const runApply = () => {
    apply.mutate(
      { ...params, productIds: excluded.size ? selectedIds : undefined },
      {
        onSuccess: ({ updated }) => {
          toast.success(`Listo: se actualizaron ${updated} productos`)
          setConfirming(false)
          preview.reset()
          setPreviewedWith(null)
        },
        onError: (error) => {
          toast.error(errorMessage(error))
          setConfirming(false)
        },
      },
    )
  }

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = rows.length > 0 && excluded.size === 0
  const categoryName = categories.data?.find((c) => c.id === categoryId)?.name

  return (
    <Page>
      <PageHeader
        title="Actualizar precios"
        subtitle="Aplicá un aumento o una rebaja a muchos productos a la vez, con redondeo comercial. Primero ves el resultado, después confirmás."
      />

      <div className={styles.layout}>
        <Card title="Regla">
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              runPreview()
            }}
          >
            <Field label="Productos">
              <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.productCount})
                  </option>
                ))}
              </Select>
            </Field>
            <div className={styles.group}>
              <span className={styles.groupLabel}>Qué actualizar</span>
              <SegmentedControl label="Qué actualizar" value={target} options={TARGETS} onChange={setTarget} />
              <span className={styles.groupHint}>Si te subió el proveedor, actualizá ambos para mantener el margen.</span>
            </div>
            <Field label="Porcentaje" hint="Usá un número negativo para rebajar (ej. -20 para una liquidación)." error={formError}>
              <Input
                inputMode="decimal"
                placeholder="Ej. 8"
                value={percentText}
                onChange={(event) => setPercentText(event.target.value)}
                className="tabular"
              />
            </Field>
            {target !== 'cost' && (
              <>
                <Field label="Redondeo del precio">
                  <Select value={roundTo} onChange={(event) => setRoundTo(Number(event.target.value) as RoundingStep)}>
                    {ROUNDING_STEPS.map((step) => (
                      <option key={step} value={step}>
                        {ROUNDING_LABELS[step]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {roundTo !== 1 && <SegmentedControl label="Dirección del redondeo" value={direction} options={DIRECTIONS} onChange={setDirection} />}
              </>
            )}

            {validPercent && target !== 'cost' && (
              <p className={styles.example} aria-live="polite">
                Ejemplo: un producto de <strong>{formatMoney(EXAMPLE_PRICE)}</strong> pasa a{' '}
                <strong>{formatMoney(adjustAmount(EXAMPLE_PRICE, { percent, roundTo, direction }))}</strong>
              </p>
            )}

            <Button type="submit" variant="primary" icon="search" loading={preview.isPending} block>
              Ver vista previa
            </Button>
          </form>
        </Card>

        <Card flush title="Vista previa" description={preview.data ? `${preview.data.count} productos ${categoryName ? `de ${categoryName}` : ''}` : undefined}>
          {preview.isPending ? (
            <LoadingState />
          ) : !preview.data ? (
            <EmptyState icon="tag" title="Definí la regla y mirá el resultado">
              Nada se modifica hasta que confirmes.
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState title="No hay productos activos en esa categoría" />
          ) : (
            <>
              {isStale && (
                <p className={styles.stale} role="status">
                  <Icon name="alert" size={16} /> Cambiaste la regla: actualizá la vista previa antes de aplicar.
                </p>
              )}
              <div className={styles.scroll}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '1%' }}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          aria-label="Seleccionar todos"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = excluded.size > 0 && excluded.size < rows.length
                          }}
                          onChange={() => setExcluded(allSelected ? new Set(rows.map((r) => r.productId)) : new Set())}
                        />
                      </th>
                      <th scope="col">Producto</th>
                      <th scope="col" className={table.num}>
                        {target === 'cost' ? 'Costo' : 'Precio'}
                      </th>
                      <th scope="col" className={table.num}>
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const [from, to] = target === 'cost' ? [row.oldCostCents, row.newCostCents] : [row.oldPriceCents, row.newPriceCents]
                      return (
                        <tr key={row.productId} style={{ opacity: excluded.has(row.productId) ? 0.45 : 1 }}>
                          <td>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              aria-label={`Incluir ${row.name}`}
                              checked={!excluded.has(row.productId)}
                              onChange={() => toggle(row.productId)}
                            />
                          </td>
                          <td className={table.full}>
                            <span className={table.primaryCell}>{row.name}</span>
                            <span className={table.secondaryText}>
                              <span className="mono">{row.sku}</span> · {row.category ?? 'Sin categoría'}
                            </span>
                          </td>
                          <td data-label={target === 'cost' ? 'Costo' : 'Precio'} className={table.num}>
                            <span className={styles.old}>{formatMoney(from)}</span>
                            <span className={styles.arrow} aria-label="pasa a">
                              →
                            </span>
                            <strong>{formatMoney(to)}</strong>
                          </td>
                          <td data-label="Margen" className={table.num}>
                            {row.oldMargin === null ? '—' : formatPercent(row.oldMargin)}
                            <span className={styles.arrow} aria-label="pasa a">
                              →
                            </span>
                            {row.newMargin === null ? '—' : formatPercent(row.newMargin)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.summary}>
                <span>
                  <strong className="tabular">{selectedIds.length}</strong> de {rows.length} productos seleccionados
                </span>
                <Button variant="primary" icon="check" disabled={isStale || selectedIds.length === 0} onClick={() => setConfirming(true)}>
                  Aplicar a {selectedIds.length} productos
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Aplicar la actualización?"
        description={`Se modificará ${target === 'price' ? 'el precio' : target === 'cost' ? 'el costo' : 'el precio y el costo'} de ${selectedIds.length} productos (${percent > 0 ? '+' : ''}${formatPercent(percent)}). Queda registrado en el historial de cada producto.`}
        dismissible={!apply.isPending}
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={apply.isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={runApply} loading={apply.isPending}>
              Sí, aplicar
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
          Las ventas ya registradas no cambian: cada venta guarda el precio del momento.
        </p>
      </Dialog>
    </Page>
  )
}
