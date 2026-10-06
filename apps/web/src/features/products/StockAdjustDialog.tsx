import { type ProductDto, type StockAdjustmentInput, stockAdjustmentSchema } from '@stock/shared'
import { type FormEvent, useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Field, Input, Textarea } from '../../shared/ui/Field'
import { Icon } from '../../shared/ui/Icon'
import { MoneyInput } from '../../shared/ui/MoneyInput'
import { SegmentedControl } from '../../shared/ui/SegmentedControl'
import { useToast } from '../../shared/ui/Toast'
import { useAdjustStock } from './api'
import styles from './products.module.css'

type AdjustmentType = StockAdjustmentInput['type']

const TYPES = [
  { value: 'PURCHASE', label: 'Ingreso' },
  { value: 'LOSS', label: 'Pérdida' },
  { value: 'COUNT', label: 'Recuento' },
] as const

const DESCRIPTIONS: Record<AdjustmentType, string> = {
  PURCHASE: 'Llegó mercadería del proveedor.',
  LOSS: 'Rotura, falla de fábrica o faltante. Queda registrado con el motivo.',
  COUNT: 'Contaste el stock físico: ingresá lo que hay y ajustamos la diferencia.',
}

export function StockAdjustDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product: ProductDto }) {
  return (
    <Dialog open={open} onClose={onClose} title={`Ajustar stock · ${product.name}`}>
      {open && <AdjustForm product={product} onDone={onClose} />}
    </Dialog>
  )
}

function AdjustForm({ product, onDone }: { product: ProductDto; onDone: () => void }) {
  const [type, setType] = useState<AdjustmentType>('PURCHASE')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const adjust = useAdjustStock(product.id)
  const toast = useToast()

  const amount = Number.parseInt(quantity, 10)
  const resulting = Number.isNaN(amount)
    ? null
    : type === 'PURCHASE'
      ? product.stock + amount
      : type === 'LOSS'
        ? product.stock - amount
        : amount

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const input =
      type === 'COUNT'
        ? { type, countedStock: amount, note: note || undefined }
        : type === 'LOSS'
          ? { type, quantity: amount, note }
          : { type, quantity: amount, unitCostCents: unitCost ?? undefined, note: note || undefined }
    // Valida con el mismo esquema que la API antes de enviar.
    const parsed = stockAdjustmentSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    setErrors({})
    adjust.mutate(parsed.data, {
      onSuccess: (movement) => {
        toast.success(`Stock actualizado: ${movement.stockAfter} unidades`)
        onDone()
      },
      onError: (error) => setErrors({ form: errorMessage(error) }),
    })
  }

  const quantityError = errors.quantity ?? errors.countedStock

  return (
    <form className={styles.adjustForm} onSubmit={submit} noValidate>
      <SegmentedControl
        label="Tipo de movimiento"
        value={type}
        options={TYPES}
        onChange={(value) => {
          setType(value)
          setErrors({})
        }}
      />
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>{DESCRIPTIONS[type]}</p>

      <Field label={type === 'COUNT' ? 'Unidades contadas' : 'Cantidad'} error={quantityError}>
        <Input
          type="number"
          min={type === 'COUNT' ? 0 : 1}
          inputMode="numeric"
          autoFocus
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>

      {type === 'PURCHASE' && product.costCents !== undefined && (
        <Field label="Nuevo costo unitario" optional hint="Si el proveedor cambió el precio, actualizamos el costo." error={errors.unitCostCents}>
          <MoneyInput value={unitCost} onChange={setUnitCost} placeholder={String(product.costCents / 100)} />
        </Field>
      )}

      <Field label="Motivo" optional={type !== 'LOSS'} error={errors.note}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder={type === 'LOSS' ? 'Ej. tabla con el laminado abierto' : ''} />
      </Field>

      <div className={styles.preview} aria-live="polite">
        <span>{product.stock}</span>
        <Icon name="arrowRight" size={16} />
        <strong style={{ color: resulting !== null && resulting < 0 ? 'var(--color-danger)' : undefined }}>{resulting ?? '—'}</strong>
        <span style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>unidades</span>
      </div>

      {errors.form && (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      )}

      <div className={styles.formActions}>
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={adjust.isPending}>
          Registrar movimiento
        </Button>
      </div>
    </form>
  )
}
