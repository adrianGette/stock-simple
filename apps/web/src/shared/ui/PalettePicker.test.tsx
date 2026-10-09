import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { PalettePicker } from './PalettePicker'

afterEach(() => {
  delete document.documentElement.dataset.palette
  localStorage.clear()
})

describe('PalettePicker', () => {
  it('arranca en Índigo y aplica la paleta elegida en <html>', async () => {
    const user = userEvent.setup()
    render(<PalettePicker />)
    expect(screen.getByRole('radio', { name: 'Índigo' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Grafito' }))

    expect(document.documentElement.dataset.palette).toBe('graphite')
    expect(localStorage.getItem('color-palette')).toBe('graphite')
    expect(screen.getByRole('radio', { name: 'Grafito' })).toBeChecked()
  })

  it('volver a Índigo limpia la elección: es la paleta de base', async () => {
    const user = userEvent.setup()
    render(<PalettePicker />)
    await user.click(screen.getByRole('radio', { name: 'Océano' }))
    await user.click(screen.getByRole('radio', { name: 'Índigo' }))

    expect(document.documentElement.dataset.palette).toBeUndefined()
    expect(localStorage.getItem('color-palette')).toBeNull()
  })

  it('se maneja con el teclado como cualquier grupo de radios', async () => {
    const user = userEvent.setup()
    render(<PalettePicker />)
    screen.getByRole('radio', { name: 'Índigo' }).focus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Océano' })).toBeChecked()
    expect(document.documentElement.dataset.palette).toBe('ocean')
  })
})
