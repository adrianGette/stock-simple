import { PAYMENT_METHOD_LABELS, voidSaleSchema } from '@stock/shared'
import { useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { formatDateTime, formatMoney } from '../../lib/format'
import { Avatar } from '../../shared/ui/Avatar'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { ErrorState, LoadingState } from '../../shared/ui/Feedback'
import { Field, Textarea } from '../../shared/ui/Field'
import table from '../../shared/ui/table.module.css'
import { useToast } from '../../shared/ui/Toast'
import { useCurrentUser } from '../auth/AuthProvider'
import { useSale, useVoidSale } from './api'
import styles from './sales.module.css'

export function SaleDetailDialog({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  const sale = useSale(saleId)
  const user = useCurrentUser()
  const [voiding, setVoiding] = useState(false)

  const title = sale.data ? `Venta #${sale.data.number}` : 'Venta'
  const canVoid = sale.data?.status === 'COMPLETED' && user.can('sales:void')
  return (
    <Dialog
      open={saleId !== null}
      onClose={() => {
        setVoiding(false)
        onClose()
      }}
      title={title}
      description={sale.data ? formatDateTime(sale.data.createdAt) : undefined}
      icon="receipt"
      wide
      footer={
        canVoid &&
        !voiding && (
          <Button variant="ghost" icon="undo" className={styles.voidButton} onClick={() => setVoiding(true)}>
            Anular venta
          </Button>
        )
      }
    >
      {sale.isPending ? (
        <LoadingState />
      ) : sale.isError ? (
        <ErrorState error={sale.error} />
      ) : (
        <div className={styles.detail}>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Vendió</dt>
              <dd className={styles.person}>
                <Avatar name={sale.data.user.name} userId={sale.data.user.id} photoVersion={sale.data.user.photoVersion} size="sm" />
                {sale.data.user.name}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Medio de pago</dt>
              <dd>{PAYMENT_METHOD_LABELS[sale.data.paymentMethod]}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Estado</dt>
              <dd>
                {sale.data.status === 'VOIDED' ? (
                  <Badge tone="danger" icon="undo">
                    Anulada
                  </Badge>
                ) : (
                  <Badge tone="success" icon="check">
                    Completada
                  </Badge>
                )}
              </dd>
            </div>
          </dl>

          {sale.data.status === 'VOIDED' && (
            <p className={styles.voidNote}>
              Anulada por {sale.data.voidedBy?.name} el {formatDateTime(sale.data.voidedAt!)}: «{sale.data.voidReason}»
            </p>
          )}

          <div className={styles.itemsBox}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className={table.num}>
                    Cant.
                  </th>
                  <th scope="col" className={table.num}>
                    Precio
                  </th>
                  <th scope="col" className={table.num}>
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.data.items.map((item) => (
                  <tr key={item.productId}>
                    <td className={table.full}>
                      <span className={table.primaryCell}>{item.productName}</span>
                      <span className={`${table.secondaryText} mono`}>{item.sku}</span>
                    </td>
                    <td data-label="Cantidad" className={table.num}>
                      {item.quantity}
                    </td>
                    <td data-label="Precio" className={table.num}>
                      {formatMoney(item.unitPriceCents)}
                    </td>
                    <td data-label="Subtotal" className={table.num}>
                      {formatMoney(item.subtotalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className={styles.totals}>
            {sale.data.costCents !== undefined && (
              <>
                <div className={styles.totalRow}>
                  <dt>Costo de mercadería</dt>
                  <dd className="tabular">{formatMoney(sale.data.costCents)}</dd>
                </div>
                <div className={styles.totalRow}>
                  <dt>Ganancia</dt>
                  <dd className={`tabular ${styles.profit}`}>{formatMoney(sale.data.totalCents - sale.data.costCents)}</dd>
                </div>
              </>
            )}
            <div className={`${styles.totalRow} ${styles.grandTotal}`}>
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(sale.data.totalCents)}</dd>
            </div>
          </dl>

          {voiding && <VoidForm saleId={sale.data.id} onDone={() => setVoiding(false)} />}
        </div>
      )}
    </Dialog>
  )
}

function VoidForm({ saleId, onDone }: { saleId: string; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const voidSale = useVoidSale(saleId)
  const toast = useToast()

  return (
    <form
      className={styles.voidForm}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = voidSaleSchema.safeParse({ reason })
        if (!parsed.success) return setError(parsed.error.issues[0]?.message)
        voidSale.mutate(parsed.data, {
          onSuccess: (sale) => {
            toast.success(`Venta #${sale.number} anulada. El stock se devolvió.`)
            onDone()
          },
          onError: (e) => setError(errorMessage(e)),
        })
      }}
    >
      <Field label="Motivo de la anulación" hint="La venta no se borra: queda registrada como anulada y vuelve el stock." error={error}>
        <Textarea rows={2} autoFocus value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className={styles.voidActions}>
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="danger" icon="undo" loading={voidSale.isPending}>
          Confirmar anulación
        </Button>
      </div>
    </form>
  )
}
