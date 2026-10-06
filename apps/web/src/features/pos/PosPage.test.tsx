import type { CreateSaleInput, Paginated, ProductDto } from '@stock/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ToastProvider } from '../../shared/ui/Toast'
import { PosPage } from './PosPage'

const product = (overrides: Partial<ProductDto>): ProductDto => ({
  id: crypto.randomUUID(),
  sku: 'SKU',
  barcode: null,
  name: 'Producto',
  category: null,
  priceCents: 100_000,
  stock: 10,
  minStock: 2,
  active: true,
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const deck = product({ name: 'Tabla Ruido 8.0"', sku: 'TAB-01', priceCents: 8_990_000, stock: 3 })
const grip = product({ name: 'Lija grip negra', sku: 'ACC-01', priceCents: 1_290_000, stock: 0 })
const sales: CreateSaleInput[] = []

// MSW intercepta fetch a nivel de red: el componente usa el cliente HTTP real.
const server = setupServer(
  http.get('*/api/products', () =>
    HttpResponse.json<Paginated<ProductDto>>({ items: [deck, grip], total: 2, page: 1, pageSize: 24 }),
  ),
  http.post('*/api/sales', async ({ request }) => {
    const body = (await request.json()) as CreateSaleInput
    sales.push(body)
    return HttpResponse.json({ id: crypto.randomUUID(), number: 42, totalCents: 8_990_000, items: [] }, { status: 201 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  sales.length = 0
})
afterAll(() => server.close())

function renderPos() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <PosPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('PosPage', () => {
  it('no deja agregar productos sin stock ni más unidades de las disponibles', async () => {
    const user = userEvent.setup()
    renderPos()

    expect(await screen.findByRole('button', { name: /Agregar Lija grip negra/ })).toBeDisabled()

    const addDeck = screen.getByRole('button', { name: /Agregar Tabla Ruido 8\.0/ })
    for (let i = 0; i < 3; i++) await user.click(addDeck)
    expect(addDeck).toBeDisabled()

    const cart = screen.getByRole('complementary', { name: 'Carrito' })
    expect(within(cart).getByLabelText('Cantidad de Tabla Ruido 8.0"')).toHaveValue(3)
    expect(cart).toHaveTextContent('$ 269.700,00')
  })

  it('cobra con una clave de idempotencia y vacía el carrito', async () => {
    const user = userEvent.setup()
    renderPos()

    await user.click(await screen.findByRole('button', { name: /Agregar Tabla Ruido 8\.0/ }))
    await user.click(within(screen.getByRole('complementary', { name: 'Carrito' })).getByRole('button', { name: 'Cobrar' }))

    const dialog = screen.getByRole('dialog', { name: 'Cobrar venta' })
    await user.click(within(dialog).getByRole('button', { name: 'Justo' }))
    expect(dialog).toHaveTextContent('Vuelto')
    await user.click(within(dialog).getByRole('button', { name: /Confirmar/ }))

    expect(await screen.findByText(/Venta #42 registrada/)).toBeInTheDocument()
    expect(sales).toEqual([
      { idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/), paymentMethod: 'CASH', items: [{ productId: deck.id, quantity: 1 }] },
    ])
    expect(screen.getByText('El carrito está vacío')).toBeInTheDocument()
  })
})
