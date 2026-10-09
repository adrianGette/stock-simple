import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar, initials } from './Avatar'

describe('Avatar', () => {
  it('arma las iniciales con el primer y el último nombre', () => {
    expect(initials('Laura Méndez')).toBe('LM')
    expect(initials('  sofía  ')).toBe('S')
    expect(initials('Juan Martín Pérez')).toBe('JP')
  })

  it('a la misma persona le da siempre el mismo color, y la foto reemplaza a las iniciales', () => {
    const first = render(<Avatar name="Laura Méndez" seed="user-1" />).container.firstElementChild as HTMLElement
    const again = render(<Avatar name="Laura Méndez" seed="user-1" />).container.firstElementChild as HTMLElement
    expect(first.style.background).toBe(again.style.background)
    expect(first.textContent).toBe('LM')

    const photo = render(<Avatar name="Laura Méndez" photoUrl="/foto.webp" />).container.firstElementChild
    expect(photo?.tagName).toBe('IMG')
  })
})
