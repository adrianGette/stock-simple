import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod, type SaleDto } from '@stock/shared'
import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { formatMoney } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Field } from '../../shared/ui/Field'
import { Icon } from '../../shared/ui/Icon'
import { MoneyInput } from '../../shared/ui/MoneyInput'
import { useCreateSale } from '../sales/api'
import { type CartState, cartTotal, suggestedCashAmounts } from './cart'
import styles from './CheckoutDialog.module.css'

interface CheckoutDialogProps {
  open: boolean
  cart: CartState
  onClose: () => void
  onSuccess: (sale: SaleDto) => void
}

export function CheckoutDialog({ open, cart, onClose, onSuccess }: CheckoutDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [received, setReceived] = useState<number | null>(null)
  const createSale = useCreateSale()
  const total = cartTotal(cart.lines)

  useEffect(() => {
    if (open) {
      setReceived(null)
      createSale.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open])

  const change = received !== null && !Number.isNaN(received) ? received - total : null
  const cashMissing = method === 'CASH' && change !== null && change < 0

  const confirm = () => {
    if (cashMissing || createSale.isPending) return
    createSale.mutate(
      {
        idempotencyKey: cart.saleKey,
        paymentMethod: method,
        items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      },
      { onSuccess },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cobrar venta"
      dismissible={!createSale.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={createSale.isPending}>
            Volver
          </Button>
          <Button variant="primary" icon="check" onClick={confirm} loading={createSale.isPending} disabled={cashMissing}>
            Confirmar {formatMoney(total)}
          </Button>
        </>
      }
    >
      <form
        className={styles.content}
        onSubmit={(event) => {
          event.preventDefault()
          confirm()
        }}
      >
        <div className={styles.total}>
          <span className={styles.totalLabel}>Total a cobrar</span>
          <span className={`${styles.totalValue} tabular`}>{formatMoney(total)}</span>
        </div>

        <fieldset className={styles.methods}>
          <legend>Medio de pago</legend>
          {PAYMENT_METHODS.map((value) => (
            <label key={value} className={styles.method}>
              <input type="radio" name="payment" value={value} checked={method === value} onChange={() => setMethod(value)} />
              {PAYMENT_METHOD_LABELS[value]}
            </label>
          ))}
        </fieldset>

        {method === 'CASH' && (
          <div className={styles.cash}>
            <Field label="Paga con" optional hint="Para calcular el vuelto.">
              <MoneyInput value={received} onChange={setReceived} placeholder="0" />
            </Field>
            <div className={styles.quick}>
              {suggestedCashAmounts(total).map((amount, index) => (
                <Button key={amount} size="sm" onClick={() => setReceived(amount)}>
                  {index === 0 ? 'Justo' : formatMoney(amount, { compact: true })}
                </Button>
              ))}
            </div>
            {change !== null && !Number.isNaN(change) && (
              <div className={styles.change} aria-live="polite">
                <span>{change >= 0 ? 'Vuelto' : 'Falta'}</span>
                <span className={[styles.changeValue, change < 0 && styles.missing, 'tabular'].filter(Boolean).join(' ')}>
                  {formatMoney(Math.abs(change))}
                </span>
              </div>
            )}
          </div>
        )}

        {createSale.isError && (
          <div className={styles.error} role="alert">
            <Icon name="alert" size={16} /> {errorMessage(createSale.error)}
          </div>
        )}
        {/* Enter dentro del formulario confirma la venta. */}
        <button type="submit" hidden aria-label="Confirmar venta" />
      </form>
    </Dialog>
  )
}
