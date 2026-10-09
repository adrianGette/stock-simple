import { describe, expect, it } from 'vitest'
import { CSV_BOM, csvCell, csvHeader, csvMoney, csvRow, csvRows, csvUnescape, parseCsv } from './csv'

const cells = (text: string) => parseCsv(text).map((record) => record.cells)

describe('parseCsv', () => {
  it('lee el formato de Excel en español (; y CRLF) e ignora el BOM', () => {
    expect(cells(`${CSV_BOM}SKU;Nombre\r\nA-1;Lija\r\n`)).toEqual([
      ['SKU', 'Nombre'],
      ['A-1', 'Lija'],
    ])
  })

  it('detecta la coma como separador (Google Sheets)', () => {
    expect(cells('SKU,Nombre,Precio\nA-1,Lija,"1.250,50"\n')).toEqual([
      ['SKU', 'Nombre', 'Precio'],
      ['A-1', 'Lija', '1.250,50'],
    ])
  })

  it('respeta comillas: separadores, comillas escapadas y saltos de línea dentro de una celda', () => {
    expect(cells('a;b\n"Tabla 8.0"" Pro; edición limitada";"línea 1\nlínea 2"\n')).toEqual([
      ['a', 'b'],
      ['Tabla 8.0" Pro; edición limitada', 'línea 1\nlínea 2'],
    ])
  })

  it('ignora filas vacías pero conserva el número de fila de la planilla', () => {
    const records = parseCsv('SKU;Nombre\n\nA-1;Lija\n;\nB-2;Medias')
    expect(records.map((record) => record.row)).toEqual([1, 3, 5])
  })

  it('lee de vuelta lo que escribe la exportación', () => {
    const exported = csvRow(['=1+1', 'Tabla 8.0"', csvMoney(125_050)])
    const [record] = parseCsv(exported)
    expect(record?.cells.map(csvUnescape)).toEqual(['=1+1', 'Tabla 8.0"', '1250,50'])
  })
})

describe('csvUnescape', () => {
  it('saca solo el apóstrofo de seguridad, no los que son parte del texto', () => {
    expect(csvUnescape("'=SUM(A1)")).toBe('=SUM(A1)')
    expect(csvUnescape("'-descuento")).toBe('-descuento')
    expect(csvUnescape("'Tabla'")).toBe("'Tabla'")
    expect(csvUnescape('Medias')).toBe('Medias')
  })
})

describe('csv', () => {
  it('deja el texto simple como está', () => {
    expect(csvCell('Remera Box Flame')).toBe('Remera Box Flame')
    expect(csvCell('Señal ñandú')).toBe('Señal ñandú')
  })

  it('entrecomilla las celdas con separador, comillas o saltos de línea', () => {
    expect(csvCell('Lija; grip')).toBe('"Lija; grip"')
    expect(csvCell('Tabla 8.5" Pro')).toBe('"Tabla 8.5"" Pro"')
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"')
  })

  it('neutraliza el texto que la planilla ejecutaría como fórmula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(csvCell('+54 11')).toBe("'+54 11")
    expect(csvCell('-descuento')).toBe("'-descuento")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('\t=1+1')).toBe("'\t=1+1")
  })

  it('escribe los números tal cual, incluso negativos, con coma decimal', () => {
    expect(csvCell(42)).toBe('42')
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(1.5)).toBe('1,5')
  })

  it('escribe montos en pesos con coma decimal y sin separador de miles', () => {
    expect(csvCell(csvMoney(125_050))).toBe('1250,50')
    expect(csvCell(csvMoney(5))).toBe('0,05')
    expect(csvCell(csvMoney(0))).toBe('0,00')
    expect(csvCell(csvMoney(-125_050))).toBe('-1250,50')
    expect(csvCell(csvMoney(100_000_000_000))).toBe('1000000000,00')
  })

  it('traduce booleanos y vacíos', () => {
    expect(csvCell(true)).toBe('Sí')
    expect(csvCell(false)).toBe('No')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('arma filas con ; y CRLF, y el encabezado con BOM', () => {
    const columns = [
      { header: 'Nombre', value: (p: { name: string; price: number }) => p.name },
      { header: 'Precio', value: (p: { name: string; price: number }) => csvMoney(p.price) },
    ]
    expect(csvRow(['a', 1, null])).toBe('a;1;\r\n')
    expect(csvHeader(columns)).toBe(`${CSV_BOM}Nombre;Precio\r\n`)
    expect(csvRows(columns, [{ name: 'Lija', price: 950_000 }, { name: 'Stickers', price: 150 }])).toBe(
      'Lija;9500,00\r\nStickers;1,50\r\n',
    )
  })
})
