import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

// Regresión: al pasar de celular a escritorio, el gráfico conservaba el ancho viejo y desbordaba su tarjeta.
test('el gráfico del inicio se adapta al agrandar la ventana después de achicarla', async ({ page }) => {
  await loginAs(page, 'Encargado')
  const chart = page.getByRole('img', { name: /Ventas por día/ })
  await expect(chart).toBeVisible()

  for (const width of [1000, 600, 390, 800, 1099, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(100)
  }

  const card = page.getByRole('region', { name: 'Últimos 14 días' })
  await expect
    .poll(async () => {
      const [chartBox, cardBox] = await Promise.all([chart.boundingBox(), card.boundingBox()])
      return chartBox!.x + chartBox!.width <= cardBox!.x + cardBox!.width
    })
    .toBe(true)
})
