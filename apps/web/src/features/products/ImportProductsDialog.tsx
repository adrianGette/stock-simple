import {
  PRODUCT_CSV_HEADERS,
  PRODUCT_IMPORT_MAX_BYTES,
  type ProductImportChange,
  type ProductImportPreviewDto,
} from '@stock/shared'
import { useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../lib/api-client'
import { formatInteger, formatMoney } from '../../lib/format'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { LoadingState } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { useToast } from '../../shared/ui/Toast'
import table from '../../shared/ui/table.module.css'
import { downloadImportTemplate, previewProductImport, useImportProducts } from './api'
import styles from './products.module.css'

const MAX_MB = Math.round(PRODUCT_IMPORT_MAX_BYTES / 1024 / 1024)
const plural = (count: number, one: string, many: string) => `${formatInteger(count)} ${count === 1 ? one : many}`

function formatValue(field: ProductImportChange['field'], value: ProductImportChange['before']): string {
  if (value === null || value === '') return 'vacío'
  if (field === 'cost' || field === 'price') return formatMoney(Number(value))
  if (field === 'active') return value ? 'Sí' : 'No'
  return String(value)
}

/** "Crear 2 y actualizar 5 productos", "Actualizar 1 producto"… */
function saveLabel({ toCreate, toUpdate }: ProductImportPreviewDto): string {
  const total = toCreate + toUpdate
  const noun = total === 1 ? 'producto' : 'productos'
  if (toCreate && toUpdate) return `Crear ${formatInteger(toCreate)} y actualizar ${formatInteger(toUpdate)} ${noun}`
  return `${toCreate ? 'Crear' : 'Actualizar'} ${formatInteger(total)} ${noun}`
}

/**
 * Crea o actualiza productos desde un CSV en dos pasos: al elegir el archivo, la API lo revisa sin
 * guardar nada (vista previa, con el detalle de cada cambio); recién al confirmar se guarda todo junto,
 * o nada. El SKU identifica cada producto.
 */
export function ImportProductsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const importing = useImportProducts()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ProductImportPreviewDto | null>(null)
  const [checking, setChecking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  function close() {
    setFile(null)
    setPreview(null)
    setProblem(null)
    importing.reset()
    onClose()
  }

  async function check(selected: File | undefined) {
    if (inputRef.current) inputRef.current.value = '' // permite volver a elegir el mismo archivo después de corregirlo
    if (!selected) return
    setFile(selected)
    setPreview(null)
    setProblem(null)
    if (selected.size > PRODUCT_IMPORT_MAX_BYTES) return setProblem(`El archivo supera el máximo de ${MAX_MB} MB.`)
    setChecking(true)
    try {
      setPreview(await previewProductImport(selected))
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  async function confirm() {
    if (!file) return
    try {
      const result = await importing.mutateAsync(file)
      const parts = [
        result.created && `se crearon ${plural(result.created, 'producto', 'productos')}`,
        result.updated && `se actualizaron ${plural(result.updated, 'producto', 'productos')}`,
        result.newCategories.length && `${plural(result.newCategories.length, 'categoría nueva', 'categorías nuevas')}`,
      ].filter(Boolean)
      const message = parts.join(', ')
      toast.success(message.charAt(0).toUpperCase() + message.slice(1))
      close()
    } catch (error) {
      // Entre la vista previa y la confirmación algo cambió (p. ej. alguien creó un SKU): mostramos la revisión nueva.
      if (error instanceof ApiError && error.code === 'IMPORT_INVALID') setPreview(error.details as ProductImportPreviewDto)
      else setProblem(errorMessage(error))
    }
  }

  const ready = preview !== null && preview.errorCount === 0 && preview.toCreate + preview.toUpdate > 0 && !checking

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      dismissible={!importing.isPending}
      title="Importar productos"
      description="Creá o actualizá muchos productos a la vez desde una planilla."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={importing.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="check" disabled={!ready} loading={importing.isPending} onClick={confirm}>
            {ready ? saveLabel(preview) : 'Importar'}
          </Button>
        </>
      }
    >
      <div className={styles.importBody}>
        <ol className={styles.importSteps}>
          <li>Descargá la plantilla, o exportá tus productos para editarlos: tienen las mismas columnas.</li>
          <li>
            Completala en Excel, Google Sheets o LibreOffice y guardala como CSV. Si usás Excel, formateá la columna Código de
            barras como texto.
          </li>
          <li>
            Subila: antes de guardar nada te mostramos qué va a pasar. El SKU identifica cada producto: si ya existe se
            actualiza (menos el stock, que se corrige con un conteo) y si no, se crea. Una celda vacía borra ese dato.
          </li>
        </ol>

        <div className={styles.importActions}>
          <Button icon="download" onClick={downloadImportTemplate}>
            Descargar plantilla
          </Button>
          <Button icon="plus" onClick={() => inputRef.current?.click()} disabled={checking || importing.isPending}>
            {file ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => check(event.target.files?.[0])}
          />
        </div>

        {file && <p className={styles.importFile}>Archivo: {file.name}</p>}

        {checking && <LoadingState label="Revisando el archivo…" />}

        {problem && (
          <p className={styles.formError} role="alert">
            {problem}
          </p>
        )}

        {preview && !checking && preview.errorCount === 0 && (
          <>
            <div className={ready ? styles.importSummary : styles.importNeutral} role="status">
              <Icon name={ready ? 'check' : 'info'} size={18} />
              <div>
                <strong>
                  {ready ? 'Todo en orden.' : 'No hay nada para guardar: los productos del archivo ya están así.'}
                </strong>
                <p>
                  {[
                    preview.toCreate && `Se crean ${plural(preview.toCreate, 'producto', 'productos')}.`,
                    preview.toUpdate && `Se actualizan ${plural(preview.toUpdate, 'producto', 'productos')}.`,
                    preview.unchanged && `${plural(preview.unchanged, 'producto queda', 'productos quedan')} sin cambios.`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                {preview.newCategories.length > 0 && <p>Categorías nuevas: {preview.newCategories.join(', ')}.</p>}
              </div>
            </div>
            {preview.updates.length > 0 && (
              <div className={styles.importErrors}>
                <table className={table.table}>
                  <caption className="visually-hidden">Cambios en productos existentes</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={table.num}>
                        Fila
                      </th>
                      <th scope="col">Producto</th>
                      <th scope="col">Cambios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.updates.map((update) => (
                      <tr key={update.sku}>
                        <td data-label="Fila" className={table.num}>
                          {update.row}
                        </td>
                        <td data-label="Producto">
                          <span className={table.primaryCell}>{update.name}</span>
                          <span className={`${table.secondaryText} mono`}>{update.sku}</span>
                        </td>
                        <td data-label="Cambios">
                          <ul className={styles.changeList}>
                            {update.changes.map((change) => (
                              <li key={change.field}>
                                {PRODUCT_CSV_HEADERS[change.field]}: {formatValue(change.field, change.before)} →{' '}
                                <strong>{formatValue(change.field, change.after)}</strong>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.updates.length < preview.toUpdate && (
                  <p className={styles.importFile}>Se muestran los primeros {preview.updates.length} cambios.</p>
                )}
              </div>
            )}
          </>
        )}

        {preview && !checking && preview.errorCount > 0 && (
          <>
            <p className={styles.formError} role="alert">
              Encontramos {plural(preview.errorCount, 'problema', 'problemas')} en {plural(preview.rows, 'fila', 'filas')}. Corregí el
              archivo y volvé a subirlo: no se guarda nada hasta que esté todo bien.
              {preview.errors.length < preview.errorCount && ` Se muestran los primeros ${preview.errors.length}.`}
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
      </div>
    </Dialog>
  )
}
