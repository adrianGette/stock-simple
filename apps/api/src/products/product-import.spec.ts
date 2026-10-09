import { CSV_BOM, PRODUCT_IMPORT_MAX_ROWS } from '@stock/shared'
import { describe, expect, it } from 'vitest'
import { decodeCsv, normalizeKey, readProductImport } from './product-import'

const HEADER = 'SKU;Código de barras;Nombre;Categoría;Costo;Precio;Stock;Stock mínimo;Activo'
const file = (...lines: string[]) => [HEADER, ...lines].join('\r\n')
const messages = (text: string) => readProductImport(text).errors.map((e) => `${e.row ?? '-'}: ${e.message}`)

describe('readProductImport', () => {
  it('lee una fila válida con el formato de la exportación', () => {
    const result = readProductImport(`${CSV_BOM}${file('rem-01;7790001234567;Remera negra;Remeras;20000,00;39.900,00;5;2;Sí')}`)

    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      {
        row: 2,
        categoryName: 'Remeras',
        active: true,
        product: {
          sku: 'REM-01',
          barcode: '7790001234567',
          name: 'Remera negra',
          categoryId: null,
          costCents: 2_000_000,
          priceCents: 3_990_000,
          initialStock: 5,
          minStock: 2,
        },
      },
    ])
  })

  it('acepta columnas en otro orden, encabezados sin acentos y opcionales ausentes', () => {
    const result = readProductImport('precio,nombre,sku,costo\n"1.250,50",Lija,LIJ-1,600\n')
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      categoryName: null,
      active: true,
      product: { sku: 'LIJ-1', priceCents: 125_050, costCents: 60_000, initialStock: 0, minStock: 0, barcode: null },
    })
  })

  it('avisa qué columnas obligatorias faltan', () => {
    expect(messages('SKU;Nombre\nA;Lija')).toEqual([
      '-: Faltan columnas obligatorias: «Costo», «Precio». Descargá la plantilla para ver el formato.',
    ])
  })

  it('informa cada problema con su fila y su columna', () => {
    const result = messages(
      file(
        'A-1;;Lija;;abc;100;;;', // costo inválido
        'A-2;;X;;10;100;-3;;', // nombre corto, stock negativo
        'A 3;;Medias;;10;100;;;quizás', // SKU con espacio, activo ilegible
      ),
    )
    expect(result).toEqual([
      '2: Costo: «abc» no es un monto válido.',
      '3: Stock: «-3» no es una cantidad válida.',
      '3: Nombre: Mínimo 2 caracteres.',
      '4: Activo: «quizás» no se entiende; usá Sí o No.',
      '4: SKU: Solo letras, números, punto, guion y guion bajo.',
    ])
  })

  it('detecta SKU y códigos de barras repetidos dentro del archivo', () => {
    expect(messages(file('A-1;7790000000017;Lija;;10;100;;;', 'a-1;7790000000017;Medias;;10;100;;;'))).toEqual([
      '3: SKU: A-1 ya aparece en la fila 2.',
      '3: Código de barras: 7790000000017 ya aparece en la fila 2.',
    ])
  })

  it('reconoce el código de barras arruinado por la notación científica de Excel', () => {
    expect(messages(file('A-1;7,79E+12;Lija;;10;100;;;'))[0]).toContain('notación científica')
  })

  it('deshace el apóstrofo de seguridad de la exportación', () => {
    expect(readProductImport(file("A-1;;'=Lija;;10;100;;;")).rows[0]?.product.name).toBe('=Lija')
  })

  it('acepta productos inactivos', () => {
    expect(readProductImport(file('A-1;;Lija;;10;100;;;No')).rows[0]?.active).toBe(false)
  })

  it('rechaza archivos vacíos o demasiado grandes', () => {
    expect(messages('')).toEqual(['-: El archivo está vacío.'])
    expect(messages(HEADER)).toEqual(['-: El archivo no tiene productos.'])
    const tooMany = file(...Array.from({ length: PRODUCT_IMPORT_MAX_ROWS + 1 }, (_, i) => `S-${i};;Lija;;10;100;;;`))
    expect(messages(tooMany)[0]).toContain(`el máximo es ${PRODUCT_IMPORT_MAX_ROWS}`)
  })
})

describe('decodeCsv', () => {
  it('lee UTF-8 y, si no es válido, Windows-1252 (CSV de Excel en Windows)', () => {
    expect(decodeCsv(new TextEncoder().encode('Categoría'))).toBe('Categoría')
    // "Categoría" en Windows-1252: la í es el byte 0xED, inválido como UTF-8 suelto.
    expect(decodeCsv(Uint8Array.from([0x43, 0x61, 0x74, 0x65, 0x67, 0x6f, 0x72, 0xed, 0x61]))).toBe('Categoría')
  })
})

describe('normalizeKey', () => {
  it('ignora mayúsculas, acentos y espacios de más', () => {
    expect(normalizeKey('  Stock   MÍNIMO ')).toBe('stock minimo')
  })
})
