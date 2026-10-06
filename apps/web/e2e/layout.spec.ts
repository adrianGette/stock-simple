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

// Regresión: la hoja de estilos del control segmentado llegó vacía a producción y las opciones
// se veían como radios nativos. El radio real tiene que estar oculto y la opción elegida, pintada.
test('los controles segmentados se ven como botones, no como radios nativos', async ({ page }) => {
  await loginAs(page, 'Encargado')
  await page.goto('/reportes')
  const radio = page.getByRole('radio', { name: '30 días' })
  await expect(radio).toBeChecked()
  await expect(radio).toHaveCSS('opacity', '0')
  const option = page.locator('label', { has: radio })
  await expect(option).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})
