import { describe, expect, it } from 'vitest'
import { CSV_BOM, csvCell, csvHeader, csvMoney, csvRow, csvRows } from './csv'

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
