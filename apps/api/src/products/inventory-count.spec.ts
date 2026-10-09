import { CSV_BOM } from '@stock/shared'
import { describe, expect, it } from 'vitest'
import { readInventoryCount } from './inventory-count'

const HEADER = 'SKU;Nombre;Categoría;Stock del sistema;Contado'
const sheet = (...lines: string[]) => `${CSV_BOM}${[HEADER, ...lines].join('\r\n')}\r\n`

describe('readInventoryCount', () => {
  it('lee las filas contadas y saltea las que tienen "Contado" vacío', () => {
    const result = readInventoryCount(sheet('rem-01;Remera;Remeras;10;8', 'LIJ-01;Lija;;5;', 'GOR-01;Gorra;Gorras;3;3'))
    expect(result).toEqual({
      total: 3,
      skipped: 1,
      errors: [],
      rows: [
        { row: 2, sku: 'REM-01', systemStock: 10, counted: 8 },
        { row: 4, sku: 'GOR-01', systemStock: 3, counted: 3 },
      ],
    })
  })

  it('acepta coma como separador, columnas en otro orden y cantidades con punto de miles', () => {
    const result = readInventoryCount('contado,sku,stock del sistema\n1.200,TOR-01,1.180\n')
    expect(result.rows).toEqual([{ row: 2, sku: 'TOR-01', systemStock: 1180, counted: 1200 }])
  })

  it('informa cantidades inválidas, stock del sistema modificado y SKU repetidos', () => {
    const result = readInventoryCount(sheet('A-1;;;10;-2', 'A-2;;;diez;4', 'A-3;;;1;1', 'a-3;;;1;2'))
    expect(result.errors).toEqual([
      { row: 2, message: 'Contado: «-2» no es una cantidad válida.' },
      { row: 3, message: 'Stock del sistema: «diez» no es válido. No modifiques esta columna.' },
      { row: 5, message: 'SKU: A-3 ya aparece en la fila 4.' },
    ])
  })

  it('pide las columnas de la planilla de conteo', () => {
    expect(readInventoryCount('SKU;Nombre\nA-1;Lija').errors[0]?.message).toBe(
      'Faltan columnas: «Stock del sistema», «Contado». Usá la planilla de conteo que descargás desde Productos.',
    )
  })
})
