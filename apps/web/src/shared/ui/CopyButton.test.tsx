import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyButton } from './CopyButton'

const toastError = vi.fn<(message: string) => void>()
vi.mock('./Toast', () => ({ useToast: () => ({ error: toastError, success: vi.fn<(message: string) => void>() }) }))

describe('CopyButton', () => {
  it('copia el valor y avisa que se copió', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="ACC-08" label="SKU" />)

    await user.click(screen.getByRole('button', { name: 'Copiar SKU' }))

    expect(await navigator.clipboard.readText()).toBe('ACC-08')
    expect(screen.getByRole('button', { name: 'SKU copiado' })).toBeInTheDocument()
  })

  it('si el navegador no deja copiar, lo explica en lugar de fallar en silencio', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Write permission denied'))
    render(<CopyButton value="7790004038699" label="código de barras" />)

    await user.click(screen.getByRole('button', { name: 'Copiar código de barras' }))

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('No se pudo copiar'))
    expect(screen.getByRole('button', { name: 'Copiar código de barras' })).toBeInTheDocument()
  })
})
