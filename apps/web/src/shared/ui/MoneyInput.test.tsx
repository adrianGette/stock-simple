import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MoneyInput } from './MoneyInput'

function Harness({ initial = null }: { initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <MoneyInput aria-label="Monto" value={value} onChange={setValue} />
      <output data-testid="cents">{String(value)}</output>
      <button type="button" onClick={() => setValue(500_000)}>
        Atajo
      </button>
    </>
  )
}

describe('MoneyInput', () => {
  it('convierte lo escrito en pesos a centavos', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Monto'), '1.250,50')
    expect(screen.getByTestId('cents')).toHaveTextContent('125050')
  })

  it('marca como inválido un texto que no es un monto, sin colgarse', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Monto'), 'abc')
    expect(screen.getByTestId('cents')).toHaveTextContent('NaN')
    expect(screen.getByLabelText('Monto')).toHaveValue('abc')
  })

  it('refleja cambios externos del valor', async () => {
    render(<Harness initial={100} />)
    await userEvent.click(screen.getByRole('button', { name: 'Atajo' }))
    expect(screen.getByLabelText('Monto')).toHaveValue('5000')
  })
})
