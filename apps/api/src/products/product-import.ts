import {
  type CreateProduct,
  PRODUCT_CSV_HEADERS as H,
  PRODUCT_IMPORT_MAX_ROWS,
  type ProductCsvField,
  type ProductImportError,
  createProductSchema,
  csvUnescape,
  parseCsv,
  parsePesos,
} from '@stock/shared'

/** Una fila del archivo que pasó todas las validaciones que no dependen de la base. */
export interface ImportRow {
  row: number
  /** La categoría la resuelve el servicio a partir de `categoryName`. */
  product: CreateProduct
  /** Nombre de categoría tal como vino en el archivo; null si la celda está vacía. */
  categoryName: string | null
  active: boolean
}

export interface ImportFile {
  /** Filas con datos (sin el encabezado), válidas o no. */
  total: number
  rows: ImportRow[]
  errors: ProductImportError[]
}

const REQUIRED: ProductCsvField[] = ['sku', 'name', 'cost', 'price']

/** Para comparar textos escritos por personas: sin mayúsculas, acentos ni espacios de más. */
export function normalizeKey(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

const FIELD_BY_HEADER = new Map(Object.entries(H).map(([field, header]) => [normalizeKey(header), field as ProductCsvField]))

// Nombre de columna para los mensajes de error del esquema de producto.
const LABEL_BY_PATH: Record<string, string> = {
  name: H.name,
  sku: H.sku,
  barcode: H.barcode,
  costCents: H.cost,
  priceCents: H.price,
  minStock: H.minStock,
  initialStock: H.stock,
}

/** Decodifica el archivo: UTF-8 si es válido; si no, Windows-1252, que es lo que guarda Excel en Windows como "CSV (delimitado por comas)". */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Entero no negativo, aceptando punto de miles ("1.000"). */
function parseQuantity(value: string): number | null {
  const cleaned = value.replace(/\./g, '')
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null
}

function parseActive(value: string): boolean | null {
  const key = normalizeKey(value)
  if (['', 'si', 's', 'true', '1', 'activo'].includes(key)) return true
  if (['no', 'n', 'false', '0', 'inactivo'].includes(key)) return false
  return null
}

/**
 * Lee y valida el archivo sin tocar la base: columnas, formato de cada celda, reglas del producto
 * (las mismas que el formulario) y repetidos dentro del mismo archivo. Lo que depende de los datos
 * del comercio (SKU ya usado, categorías existentes) lo resuelve el servicio.
 */
export function readProductImport(text: string): ImportFile {
  const [header, ...records] = parseCsv(text)
  if (!header) return { total: 0, rows: [], errors: [{ row: null, message: 'El archivo está vacío.' }] }

  const columns = new Map<ProductCsvField, number>()
  header.cells.forEach((cell, index) => {
    const field = FIELD_BY_HEADER.get(normalizeKey(cell))
    if (field && !columns.has(field)) columns.set(field, index)
  })
  const missing = REQUIRED.filter((field) => !columns.has(field))
  if (missing.length > 0) {
    const names = missing.map((field) => `«${H[field]}»`).join(', ')
    return {
      total: records.length,
      rows: [],
      errors: [{ row: null, message: `Faltan columnas obligatorias: ${names}. Descargá la plantilla para ver el formato.` }],
    }
  }
  if (records.length === 0) return { total: 0, rows: [], errors: [{ row: null, message: 'El archivo no tiene productos.' }] }
  if (records.length > PRODUCT_IMPORT_MAX_ROWS) {
    return {
      total: records.length,
      rows: [],
      errors: [{ row: null, message: `El archivo tiene ${records.length} filas; el máximo es ${PRODUCT_IMPORT_MAX_ROWS}. Dividilo en partes.` }],
    }
  }

  const rows: ImportRow[] = []
  const errors: ProductImportError[] = []
  const skuRows = new Map<string, number>()
  const barcodeRows = new Map<string, number>()

  for (const { row, cells } of records) {
    const get = (field: ProductCsvField) => {
      const index = columns.get(field)
      return index === undefined ? '' : csvUnescape((cells[index] ?? '').trim())
    }
    const rowErrors: string[] = []

    const money = (field: 'cost' | 'price') => {
      const raw = get(field)
      const cents = raw ? parsePesos(raw) : null
      if (!raw) rowErrors.push(`${H[field]}: falta el monto.`)
      else if (cents === null) rowErrors.push(`${H[field]}: «${raw}» no es un monto válido.`)
      return cents ?? 0
    }
    const quantity = (field: 'stock' | 'minStock') => {
      const raw = get(field)
      const value = raw ? parseQuantity(raw) : 0
      if (value === null) rowErrors.push(`${H[field]}: «${raw}» no es una cantidad válida.`)
      return value ?? 0
    }

    const barcode = get('barcode')
    // Excel convierte los códigos de barras largos a notación científica (7,79E+12) si la columna no es texto.
    if (/e\+/i.test(barcode)) {
      rowErrors.push(`${H.barcode}: «${barcode}» está en notación científica. En la planilla, formateá la columna como texto.`)
    }
    const active = parseActive(get('active'))
    if (active === null) rowErrors.push(`${H.active}: «${get('active')}» no se entiende; usá Sí o No.`)

    const parsed = createProductSchema.safeParse({
      name: get('name'),
      sku: get('sku'),
      barcode: barcode || null,
      categoryId: null,
      costCents: money('cost'),
      priceCents: money('price'),
      initialStock: quantity('stock'),
      minStock: quantity('minStock'),
    })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const label = LABEL_BY_PATH[String(issue.path[0])]
        // Si la celda ya tenía un error de formato, el del esquema sobre el 0 de relleno no aporta.
        if (label && !rowErrors.some((message) => message.startsWith(`${label}:`))) rowErrors.push(`${label}: ${issue.message}.`)
      }
    }

    if (parsed.success) {
      const { sku, barcode: code } = parsed.data
      const skuRow = skuRows.get(sku)
      if (skuRow) rowErrors.push(`${H.sku}: ${sku} ya aparece en la fila ${skuRow}.`)
      else skuRows.set(sku, row)
      if (code) {
        const codeRow = barcodeRows.get(code)
        if (codeRow) rowErrors.push(`${H.barcode}: ${code} ya aparece en la fila ${codeRow}.`)
        else barcodeRows.set(code, row)
      }
    }

    const categoryName = get('category') || null
    if (categoryName && (categoryName.length < 2 || categoryName.length > 40)) {
      rowErrors.push(`${H.category}: el nombre tiene que tener entre 2 y 40 caracteres.`)
    }

    if (rowErrors.length > 0 || !parsed.success || active === null) {
      errors.push(...rowErrors.map((message) => ({ row, message })))
      continue
    }
    rows.push({ row, product: parsed.data, categoryName, active })
  }

  return { total: records.length, rows, errors }
}
