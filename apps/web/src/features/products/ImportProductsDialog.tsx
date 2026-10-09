import { PRODUCT_IMPORT_MAX_BYTES, type ProductImportPreviewDto } from '@stock/shared'
import { useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../lib/api-client'
import { formatInteger } from '../../lib/format'
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

/**
 * Importa productos nuevos desde un CSV en dos pasos: al elegir el archivo, la API lo revisa sin
 * guardar nada (vista previa); recién al confirmar se crean todos juntos, o ninguno.
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
      const categories = result.newCategories.length ? ` y ${plural(result.newCategories.length, 'categoría', 'categorías')}` : ''
      toast.success(`Se importaron ${plural(result.created, 'producto', 'productos')}${categories}`)
      close()
    } catch (error) {
      // Entre la vista previa y la confirmación algo cambió (p. ej. alguien creó un SKU): mostramos la revisión nueva.
      if (error instanceof ApiError && error.code === 'IMPORT_INVALID') setPreview(error.details as ProductImportPreviewDto)
      else setProblem(errorMessage(error))
    }
  }

  const ready = preview !== null && preview.errorCount === 0 && preview.toCreate > 0 && !checking

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      dismissible={!importing.isPending}
      title="Importar productos"
      description="Cargá muchos productos nuevos a la vez desde una planilla."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={importing.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="check" disabled={!ready} loading={importing.isPending} onClick={confirm}>
            {ready ? `Importar ${plural(preview.toCreate, 'producto', 'productos')}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className={styles.importBody}>
        <ol className={styles.importSteps}>
          <li>Descargá la plantilla (o exportá tus productos: tienen las mismas columnas).</li>
          <li>
            Completala en Excel, Google Sheets o LibreOffice y guardala como CSV. Si usás Excel, formateá la columna Código de
            barras como texto.
          </li>
          <li>Subila: antes de guardar nada te mostramos qué va a pasar.</li>
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
          <div className={styles.importSummary} role="status">
            <Icon name="check" size={18} />
            <div>
              <strong>Todo en orden: se van a crear {plural(preview.toCreate, 'producto', 'productos')}.</strong>
              {preview.newCategories.length > 0 && <p>Categorías nuevas: {preview.newCategories.join(', ')}.</p>}
            </div>
          </div>
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
