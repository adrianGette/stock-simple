import { COUNT_CSV_HEADERS as C, type CountCsvField, PRODUCT_IMPORT_MAX_ROWS, csvUnescape, parseCsv } from '@stock/shared'
import { normalizeKey, parseQuantity } from './product-import'

/** Una fila contada que pasó las validaciones que no dependen de la base. */
export interface CountRow {
  row: number
  sku: string
  systemStock: number
  counted: number
}

export interface CountFile {
  /** Filas con datos (sin el encabezado). */
  total: number
  rows: CountRow[]
  /** Filas con "Contado" vacío: no se tocan. */
  skipped: number
  errors: { row: number | null; message: string }[]
}

const REQUIRED: CountCsvField[] = ['sku', 'systemStock', 'counted']
const FIELD_BY_HEADER = new Map(Object.entries(C).map(([field, header]) => [normalizeKey(header), field as CountCsvField]))

/**
 * Lee la planilla de conteo sin tocar la base. Nombre y categoría están para quien cuenta y se
 * ignoran; lo que importa es el SKU, el stock que tenía el sistema al descargarla y lo contado.
 */
export function readInventoryCount(text: string): CountFile {
  const [header, ...records] = parseCsv(text)
  const fileError = (message: string): CountFile => ({ total: records.length, rows: [], skipped: 0, errors: [{ row: null, message }] })
  if (!header) return fileError('El archivo está vacío.')

  const columns = new Map<CountCsvField, number>()
  header.cells.forEach((cell, index) => {
    const field = FIELD_BY_HEADER.get(normalizeKey(cell))
    if (field && !columns.has(field)) columns.set(field, index)
  })
  const missing = REQUIRED.filter((field) => !columns.has(field))
  if (missing.length > 0) {
    const names = missing.map((field) => `«${C[field]}»`).join(', ')
    return fileError(`Faltan columnas: ${names}. Usá la planilla de conteo que descargás desde Productos.`)
  }
  if (records.length === 0) return fileError('La planilla no tiene productos.')
  if (records.length > PRODUCT_IMPORT_MAX_ROWS) {
    return fileError(`La planilla tiene ${records.length} filas; el máximo es ${PRODUCT_IMPORT_MAX_ROWS}. Contá por categoría.`)
  }

  const rows: CountRow[] = []
  const errors: CountFile['errors'] = []
  const skuRows = new Map<string, number>()
  let skipped = 0

  for (const { row, cells } of records) {
    const get = (field: CountCsvField) => csvUnescape((cells[columns.get(field) ?? -1] ?? '').trim())
    const countedRaw = get('counted')
    if (!countedRaw) {
      skipped++
      continue
    }

    const sku = get('sku').toUpperCase()
    const counted = parseQuantity(countedRaw)
    const systemStock = parseQuantity(get('systemStock'))
    const rowErrors: string[] = []
    if (!sku) rowErrors.push(`${C.sku}: falta el código.`)
    if (counted === null) rowErrors.push(`${C.counted}: «${countedRaw}» no es una cantidad válida.`)
    // Es la referencia para calcular la diferencia: si se tocó, el ajuste sería incorrecto.
    if (systemStock === null) rowErrors.push(`${C.systemStock}: «${get('systemStock')}» no es válido. No modifiques esta columna.`)
    const firstRow = skuRows.get(sku)
    if (sku && firstRow) rowErrors.push(`${C.sku}: ${sku} ya aparece en la fila ${firstRow}.`)
    else if (sku) skuRows.set(sku, row)

    if (rowErrors.length > 0 || counted === null || systemStock === null) {
      errors.push(...rowErrors.map((message) => ({ row, message })))
      continue
    }
    rows.push({ row, sku, systemStock, counted })
  }

  return { total: records.length, rows, skipped, errors }
}
