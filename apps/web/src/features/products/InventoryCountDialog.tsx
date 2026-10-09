import { formatInteger } from '../../lib/format'
import { useDownload } from '../../shared/hooks/useDownload'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { FileDropzone } from '../../shared/ui/FileDropzone'
import { LoadingState } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { Steps } from '../../shared/ui/Steps'
import { useToast } from '../../shared/ui/Toast'
import table from '../../shared/ui/table.module.css'
import { type ProductFilters, downloadCountSheet, previewInventoryCount, useApplyInventoryCount } from './api'
import styles from './products.module.css'
import { useCsvPreview } from './useCsvPreview'

const plural = (count: number, one: string, many: string) => `${formatInteger(count)} ${count === 1 ? one : many}`
// Con signo explícito: "+2" sobra, "−2" falta (signo menos tipográfico, no guion).
const signed = (n: number) => (n > 0 ? `+${formatInteger(n)}` : n < 0 ? `−${formatInteger(-n)}` : '0')

interface InventoryCountDialogProps {
  open: boolean
  onClose: () => void
  /** Filtros de la lista: la planilla trae los mismos productos que se ven. */
  filters: ProductFilters
  /** Si hay filtros, una descripción corta ("categoría Remeras") para que se sepa qué se va a contar. */
  filtersLabel: string | null
}

/**
 * Conteo de inventario por planilla: se descarga con el stock del sistema, se completa lo contado y se
 * sube. La diferencia se calcula contra la planilla y se aplica sobre el stock actual, así las ventas
 * hechas mientras se contaba no se descuentan dos veces.
 */
export function InventoryCountDialog({ open, onClose, filters, filtersLabel }: InventoryCountDialogProps) {
  const toast = useToast()
  const applying = useApplyInventoryCount()
  const sheet = useDownload()
  const { file, preview, checking, problem, check, confirm: apply, reset } = useCsvPreview(previewInventoryCount)

  function close() {
    reset()
    applying.reset()
    onClose()
  }

  async function confirm() {
    const result = await apply(applying.mutateAsync)
    if (!result) return
    toast.success(`Se ajustó el stock de ${plural(result.adjusted, 'producto', 'productos')}`)
    close()
  }

  const ready = preview !== null && preview.errorCount === 0 && preview.toAdjust > 0 && !checking

  return (
    <Dialog
      open={open}
      icon="clipboardCheck"
      onClose={close}
      wide
      dismissible={!applying.isPending}
      title="Conteo de inventario"
      description="Corregí el stock de muchos productos a la vez con lo que contaste en el local."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={applying.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="check" disabled={!ready} loading={applying.isPending} onClick={confirm}>
            {ready ? `Ajustar ${plural(preview.toAdjust, 'producto', 'productos')}` : 'Ajustar stock'}
          </Button>
        </>
      }
    >
      <div className={styles.importBody}>
        <Steps>
          {[
            `Descargá la planilla: trae el stock que tiene hoy el sistema.${filtersLabel ? ` Solo los productos que estás viendo (${filtersLabel}).` : ' Para contar por partes, filtrá antes por categoría.'}`,
            'Contá la mercadería y anotá cada cantidad en la columna Contado. Lo que no cuentes, dejalo vacío.',
            'Subila: te mostramos las diferencias antes de ajustar nada. Cada diferencia queda en el historial como conteo.',
          ]}
        </Steps>

        <div className={styles.importTemplate}>
          <span>{filtersLabel ? `Planilla con los productos que estás viendo (${filtersLabel}).` : 'Planilla con todo el catálogo.'}</span>
          <Button size="sm" variant="ghost" icon="download" loading={sheet.downloading} onClick={() => sheet.download(() => downloadCountSheet(filters))}>
            Descargar planilla
          </Button>
        </div>

        <FileDropzone
          accept=".csv,text/csv"
          icon="clipboardCheck"
          title="Arrastrá la planilla completada o hacé clic para elegirla"
          hint="El mismo archivo que descargaste, con la columna Contado"
          fileName={file?.name}
          disabled={checking || applying.isPending}
          onFile={check}
        />

        {checking && <LoadingState label="Revisando la planilla…" />}
        {problem && (
          <p className={styles.formError} role="alert">
            {problem}
          </p>
        )}

        {preview && !checking && preview.errorCount > 0 && (
          <>
            <p className={styles.formError} role="alert">
              Encontramos {plural(preview.errorCount, 'problema', 'problemas')}. Corregí la planilla y volvé a subirla: no se ajusta
              nada hasta que esté todo bien.
            </p>
            <div className={styles.importErrors}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th scope="col" className={table.num}>
                      Fila
                    </th>
                    <th scope="col">Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((error, index) => (
                    <tr key={index}>
                      <td data-label="Fila" className={table.num}>
                        {error.row ?? '—'}
                      </td>
                      <td data-label="Problema">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {preview && !checking && preview.errorCount === 0 && (
          <>
            {preview.movedSince > 0 && (
              <div className={styles.importWarning} role="note">
                <Icon name="alert" size={18} />
                <p>
                  {plural(preview.movedSince, 'producto tuvo', 'productos tuvieron')} movimientos (por ejemplo, ventas) desde que
                  descargaste la planilla. La diferencia se aplica sobre el stock actual (columna Ahora), así esas ventas no se
                  descuentan dos veces.
                </p>
              </div>
            )}
            <div className={ready ? styles.importSummary : styles.importNeutral} role="status">
              <Icon name={ready ? 'check' : 'info'} size={18} />
              <div>
                <strong>{ready ? 'Listo para ajustar.' : 'No hay diferencias: lo contado coincide con el sistema.'}</strong>
                <p>
                  {[
                    preview.toAdjust && `${plural(preview.toAdjust, 'producto tiene', 'productos tienen')} diferencias.`,
                    preview.matching && `${plural(preview.matching, 'coincide', 'coinciden')} con lo contado.`,
                    preview.skipped && `${plural(preview.skipped, 'fila quedó', 'filas quedaron')} sin contar.`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </div>
            </div>
            {preview.lines.length > 0 && (
              <div className={styles.importErrors}>
                <table className={table.table}>
                  <caption className="visually-hidden">Diferencias por producto</caption>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col" className={table.num}>
                        Planilla
                      </th>
                      <th scope="col" className={table.num}>
                        Ahora
                      </th>
                      <th scope="col" className={table.num}>
                        Contado
                      </th>
                      <th scope="col" className={table.num}>
                        Diferencia
                      </th>
                      <th scope="col" className={table.num}>
                        Queda
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => (
                      <tr key={line.sku}>
                        <td data-label="Producto">
                          <span className={table.primaryCell}>{line.name}</span>
                          <span className={`${table.secondaryText} mono`}>{line.sku}</span>
                        </td>
                        <td data-label="Planilla" className={table.num}>
                          {formatInteger(line.systemStock)}
                        </td>
                        <td data-label="Ahora" className={`${table.num} ${line.currentStock !== line.systemStock ? styles.moved : ''}`}>
                          {formatInteger(line.currentStock)}
                        </td>
                        <td data-label="Contado" className={table.num}>
                          {formatInteger(line.counted)}
                        </td>
                        <td
                          data-label="Diferencia"
                          className={`${table.num} ${line.difference < 0 ? styles.diffMissing : line.difference > 0 ? styles.diffExtra : ''}`}
                        >
                          {signed(line.difference)}
                        </td>
                        <td data-label="Queda" className={table.num}>
                          <strong>{formatInteger(line.stockAfter)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
