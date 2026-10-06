import { Badge } from '../../shared/ui/Badge'

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock <= 0)
    return (
      <Badge tone="danger" icon="x">
        Sin stock
      </Badge>
    )
  if (stock <= minStock)
    return (
      <Badge tone="warning" icon="alert">
        Bajo
      </Badge>
    )
  return null
}
