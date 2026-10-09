import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

const accent = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim())

test('la paleta de colores se elige desde el menú del usuario y se recuerda al recargar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await loginAs(page, 'Dueña')
  expect(await accent(page)).toBe('#4f46e5')

  await page.getByRole('button', { name: /^Menú de/ }).click()
  await page.getByRole('radio', { name: 'Océano' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean')
  expect(await accent(page)).toBe('#0369a1')

  // El script de index.html la aplica antes de pintar: tras recargar sigue igual, sin volver al índigo.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean')
  expect(await accent(page)).toBe('#0369a1')

  await page.getByRole('button', { name: /^Menú de/ }).click()
  await expect(page.getByRole('radio', { name: 'Océano' })).toBeChecked()
  await page.getByRole('radio', { name: 'Índigo' }).check()
  await expect(page.locator('html')).not.toHaveAttribute('data-palette', /.*/)
  expect(await page.evaluate(() => localStorage.getItem('color-palette'))).toBeNull()
})

test('en Grafito oscuro el fondo es gris neutro y el botón principal, claro con texto oscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => localStorage.setItem('color-palette', 'graphite'))
  await loginAs(page, 'Dueña')

  const button = page.getByRole('link', { name: 'Nueva venta' }).or(page.getByRole('button', { name: 'Nueva venta' })).first()
  await expect(button).toHaveCSS('color', 'rgb(24, 24, 27)')
  // Cada paleta tiene su propio fondo en modo oscuro (no el azul pizarra del índigo).
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(9, 9, 11)')
})
