import type { SortDirection } from '@stock/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SortableHeader } from './SortableHeader'

type Column = 'name' | 'price'

function Harness() {
  const [sort, setSort] = useState<Column>('name')
  const [dir, setDir] = useState<SortDirection>('asc')
  const props = { sort, dir, onSort: (column: Column, next: SortDirection) => (setSort(column), setDir(next)) }
  return (
    <table>
      <thead>
        <tr>
          <SortableHeader column="name" label="Producto" {...props} />
          <SortableHeader column="price" label="Precio" {...props} />
        </tr>
      </thead>
    </table>
  )
}

const header = (name: string) => screen.getByRole('columnheader', { name })

describe('SortableHeader', () => {
  it('marca solo la columna ordenada con aria-sort', () => {
    render(<Harness />)
    expect(header('Producto')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Precio')).not.toHaveAttribute('aria-sort')
  })

  it('el primer click ordena ascendente y el segundo invierte', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Precio' }))
    expect(header('Precio')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Producto')).not.toHaveAttribute('aria-sort')

    await user.click(screen.getByRole('button', { name: 'Precio' }))
    expect(header('Precio')).toHaveAttribute('aria-sort', 'descending')
  })

  it('se puede ordenar con el teclado', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab() // Producto
    await user.tab() // Precio
    await user.keyboard('{Enter}')
    expect(header('Precio')).toHaveAttribute('aria-sort', 'ascending')
  })
})
