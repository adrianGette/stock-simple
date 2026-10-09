/**
 * CSV pensado para abrirse con doble click en Excel en español (es-AR) sin pasos de importación:
 * UTF-8 con BOM (si no, Excel lee "Señal" como "SeÃ±al"), separador `;` (la coma es el separador
 * decimal) y fin de línea CRLF (RFC 4180).
 */
export const CSV_BOM = '﻿'
export const CSV_SEPARATOR = ';'
const CSV_EOL = '\r\n'

/** Monto en centavos: se escribe como número con coma decimal ("1250,50") para que la planilla lo pueda sumar. */
export interface CsvMoney {
  cents: number
}

export type CsvValue = string | number | boolean | CsvMoney | null | undefined

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvValue
}

// Una celda que empieza con estos caracteres la planilla la interpreta como fórmula ("CSV injection", OWASP).
const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[";\r\n]/

export const csvMoney = (cents: number): CsvMoney => ({ cents })

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  const pesos = Math.trunc(abs / 100)
  const centavos = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${pesos},${centavos}`
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  // Los números se escriben tal cual: un "-5" numérico es un número negativo, no una fórmula.
  if (typeof value === 'number') return String(value).replace('.', ',')
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object') return formatCents(value.cents)

  // El apóstrofo inicial hace que la planilla muestre el texto en vez de ejecutarlo.
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvRow(values: readonly CsvValue[]): string {
  return values.map(csvCell).join(CSV_SEPARATOR) + CSV_EOL
}

export function csvHeader<T>(columns: readonly CsvColumn<T>[]): string {
  return CSV_BOM + csvRow(columns.map((column) => column.header))
}

export function csvRows<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  return rows.map((row) => csvRow(columns.map((column) => column.value(row)))).join('')
}

export interface CsvRecord {
  /** Número de fila como lo muestra la planilla: el encabezado es la 1. */
  row: number
  cells: string[]
}

/** `;` (Excel en español) o `,` (Google Sheets, Excel en inglés): el que más aparezca en el encabezado, fuera de comillas. */
function detectSeparator(text: string): ';' | ',' {
  let semicolons = 0
  let commas = 0
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    else if (!quoted && (char === '\n' || char === '\r')) break
    else if (!quoted && char === ';') semicolons++
    else if (!quoted && char === ',') commas++
  }
  return commas > semicolons ? ',' : ';'
}

/**
 * Lee un CSV (RFC 4180): celdas entre comillas, comillas escapadas ("") y saltos de línea dentro de
 * una celda. Ignora el BOM y las filas vacías, pero conserva la numeración original para que los
 * errores digan la misma fila que muestra la planilla.
 */
export function parseCsv(text: string): CsvRecord[] {
  const input = text.startsWith(CSV_BOM) ? text.slice(1) : text
  const separator = detectSeparator(input)
  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let row = 1

  const endRecord = () => {
    cells.push(cell)
    if (cells.some((value) => value.trim() !== '')) records.push({ row, cells })
    cells = []
    cell = ''
    row++
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char !== '"') cell += char
      else if (input[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (char === '"' && cell === '') quoted = true
    else if (char === separator) {
      cells.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      endRecord()
    } else cell += char
  }
  if (cell !== '' || cells.length > 0) endRecord()
  return records
}

/** Deshace el apóstrofo que `csvCell` agrega a los textos que la planilla ejecutaría como fórmula. */
export function csvUnescape(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value
}
