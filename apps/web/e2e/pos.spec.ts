import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('la cajera cobra una venta en efectivo con vuelto y el stock baja', async ({ page }) => {
  await loginAs(page, 'Cajera')

  // Buscar y agregar dos gorras (categoría que ningún otro test modifica)
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('gorra 5 paneles')
  const product = page.getByRole('button', { name: /^Agregar Gorra 5 paneles Ruido/ })
  const stockBefore = Number((await product.textContent())?.match(/(\d+) u\./)?.[1])
  await product.click()
  await product.click()
  const cart = page.getByRole('complementary', { name: 'Carrito' })
  await expect(cart.getByLabel('Cantidad de Gorra 5 paneles Ruido')).toHaveValue('2')
  await expect(cart).toContainText('$ 65.800,00')

  await cart.getByRole('button', { name: 'Cobrar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cobrar venta' })
  await dialog.getByLabel('Paga con').fill('70000')
  await expect(dialog).toContainText('Vuelto')
  await expect(dialog).toContainText('$ 4.200,00')
  await dialog.getByRole('button', { name: /Confirmar/ }).click()

  await expect(page.getByRole('status').filter({ hasText: /Venta #\d+ registrada/ })).toBeVisible()
  await expect(cart).toContainText('El carrito está vacío')
  await expect(product).toContainText(`${stockBefore - 2} u.`)
})

test('escanear un código de barras agrega el producto', async ({ page }) => {
  await loginAs(page, 'Cajera')
  const search = page.getByRole('searchbox', { name: 'Buscar producto' })
  await search.fill('TAB-01') // el lector "tipea" el código y manda Enter
  await search.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Carrito' })).toContainText('Tabla Ruido 8.0"')
  await expect(search).toHaveValue('')
})

test('un código inexistente avisa sin romper nada', async ({ page }) => {
  await loginAs(page, 'Cajera')
  const search = page.getByRole('searchbox', { name: 'Buscar producto' })
  await search.fill('0000000000')
  await search.press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'No encontramos un producto' })).toBeVisible()
})
