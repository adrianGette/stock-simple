import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Avatar, initials } from './Avatar'

// El avatar usa React Query para traer las fotos guardadas.
const render = (ui: ReactElement) => rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('Avatar', () => {
  it('arma las iniciales con el primer y el último nombre', () => {
    expect(initials('Laura Méndez')).toBe('LM')
    expect(initials('  sofía  ')).toBe('S')
    expect(initials('Juan Martín Pérez')).toBe('JP')
  })

  it('a la misma persona le da siempre el mismo color, y la foto reemplaza a las iniciales', () => {
    const first = render(<Avatar name="Laura Méndez" userId="user-1" />).container.firstElementChild as HTMLElement
    const again = render(<Avatar name="Laura Méndez" userId="user-1" />).container.firstElementChild as HTMLElement
    expect(first.style.background).toBe(again.style.background)
    expect(first.textContent).toBe('LM')

    const photo = render(<Avatar name="Laura Méndez" photoUrl="/foto.webp" />).container.firstElementChild
    expect(photo?.tagName).toBe('IMG')

    // Sin versión de foto no se pide nada: se ven las iniciales.
    const noPhoto = render(<Avatar name="Sofía" userId="user-2" photoVersion={null} />).container.firstElementChild
    expect(noPhoto?.textContent).toBe('S')
  })
})
