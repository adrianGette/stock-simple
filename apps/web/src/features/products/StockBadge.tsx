import { Badge } from '../../shared/ui/Badge'

/**
 * En las tablas la columna ya dice "Stock" y solo se marcan los problemas. Fuera de ellas (`verbose`)
 * la etiqueta se aclara y también se muestra cuando está todo bien.
 */
export function StockBadge({ stock, minStock, verbose = false }: { stock: number; minStock: number; verbose?: boolean }) {
  if (stock <= 0)
    return (
      <Badge tone="danger" icon="x">
        Sin stock
      </Badge>
    )
  if (stock <= minStock)
    return (
      <Badge tone="warning" icon="alert">
        {verbose ? 'Stock bajo' : 'Bajo'}
      </Badge>
    )
  return verbose ? (
    <Badge tone="success" icon="check">
      Disponible
    </Badge>
  ) : null
}
