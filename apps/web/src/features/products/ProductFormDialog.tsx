import { zodResolver } from '@hookform/resolvers/zod'
import { type ProductDto, createProductSchema, marginPercent } from '@stock/shared'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, errorMessage } from '../../lib/api-client'
import { formatPercent } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Field, Input, Select } from '../../shared/ui/Field'
import { MoneyInput } from '../../shared/ui/MoneyInput'
import { useToast } from '../../shared/ui/Toast'
import { useCategories, useSaveProduct } from './api'
import styles from './products.module.css'

const money = z.number({ error: 'Ingresá un monto válido' }).int().min(0, 'No puede ser negativo')
const units = z.number({ error: 'Ingresá un número' }).int('Solo números enteros').min(0, 'No puede ser negativo')

// Reutiliza las reglas del esquema compartido y adapta los campos opcionales del formulario ('' → null).
const formSchema = z.object({
  name: createProductSchema.shape.name,
  sku: createProductSchema.shape.sku,
  barcode: z.string().trim().regex(/^(\d{8,14})?$/, 'El código de barras tiene entre 8 y 14 dígitos'),
  categoryId: z.string(),
  costCents: money,
  priceCents: money,
  minStock: units,
  initialStock: units,
})
type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

interface ProductFormDialogProps {
  open: boolean
  onClose: () => void
  /** Si se pasa, el diálogo edita ese producto. */
  product?: ProductDto
  onSaved?: (product: ProductDto) => void
}

export function ProductFormDialog({ open, onClose, product, onSaved }: ProductFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      description={product ? `${product.sku} · los cambios de precio quedan en el historial` : 'Cargalo una vez y ya lo podés vender'}
      icon={product ? 'edit' : 'box'}
      wide
    >
      {/* El formulario se monta al abrir: arranca siempre con los valores actuales. */}
      {open && <ProductForm product={product} onCancel={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function ProductForm({ product, onCancel, onSaved }: { product?: ProductDto; onCancel: () => void; onSaved?: (p: ProductDto) => void }) {
  const categories = useCategories()
  const save = useSaveProduct(product?.id)
  const toast = useToast()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      categoryId: product?.category?.id ?? '',
      costCents: product?.costCents ?? (null as unknown as number),
      priceCents: product?.priceCents ?? (null as unknown as number),
      minStock: product?.minStock ?? 0,
      initialStock: 0,
    },
  })
  const { errors, isSubmitting } = form.formState
  const [cost, price] = useWatch({ control: form.control, name: ['costCents', 'priceCents'] })
  const margin = Number.isFinite(cost) && Number.isFinite(price) ? marginPercent(cost, price) : null

  const submit = form.handleSubmit(async ({ initialStock, ...values }) => {
    const payload = { ...values, barcode: values.barcode || null, categoryId: values.categoryId || null }
    try {
      const saved = await save.mutateAsync(product ? payload : { ...payload, initialStock })
      toast.success(product ? 'Producto actualizado' : `Producto ${saved.name} creado`)
      onSaved?.(saved)
      onCancel()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SKU_TAKEN') form.setError('sku', { message: error.message })
      else if (error instanceof ApiError && error.code === 'BARCODE_TAKEN') form.setError('barcode', { message: error.message })
      else form.setError('root', { message: errorMessage(error) })
    }
  })

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label="Nombre" error={errors.name?.message} className={styles.full}>
        <Input autoFocus placeholder="Remera Ruido Logo negra · M" {...form.register('name')} />
      </Field>
      <Field label="Código (SKU)" hint="Interno del comercio, ej. REM-01-M" error={errors.sku?.message}>
        <Input className="mono" autoCapitalize="characters" {...form.register('sku')} />
      </Field>
      <Field label="Código de barras" optional hint="EAN de 8 a 14 dígitos" error={errors.barcode?.message}>
        <Input className="mono" inputMode="numeric" {...form.register('barcode')} />
      </Field>
      <Field label="Categoría" optional error={errors.categoryId?.message}>
        {(controlProps) => (
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <Select {...controlProps} value={field.value ?? ''} onValueChange={field.onChange} onBlur={field.onBlur}>
                <option value="">Sin categoría</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Stock mínimo" hint="Te avisamos cuando quede esto o menos" error={errors.minStock?.message}>
        <Input type="number" min={0} inputMode="numeric" {...form.register('minStock', { valueAsNumber: true })} />
      </Field>
      <Field label="Costo" error={errors.costCents?.message}>
        {(controlProps) => (
          <Controller
            control={form.control}
            name="costCents"
            render={({ field }) => (
              <MoneyInput {...controlProps} value={field.value ?? null} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        )}
      </Field>
      <Field label="Precio de venta" error={errors.priceCents?.message}>
        {(controlProps) => (
          <Controller
            control={form.control}
            name="priceCents"
            render={({ field }) => (
              <MoneyInput {...controlProps} value={field.value ?? null} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        )}
      </Field>
      {!product && (
        <Field label="Stock inicial" error={errors.initialStock?.message}>
          <Input type="number" min={0} inputMode="numeric" {...form.register('initialStock', { valueAsNumber: true })} />
        </Field>
      )}
      <p className={`${styles.full} ${styles.marginHint}`} aria-live="polite">
        Margen sobre precio: <strong>{margin === null ? '—' : formatPercent(margin)}</strong>
        {margin !== null && margin < 0 && ' · ¡Estás vendiendo por debajo del costo!'}
      </p>

      {errors.root && (
        <p className={`${styles.full} ${styles.formError}`} role="alert">
          {errors.root.message}
        </p>
      )}

      <div className={`${styles.full} ${styles.formActions}`}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  )
}
