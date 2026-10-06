import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('en el celular se vende con la barra inferior', async ({ page }) => {
  await loginAs(page, 'Cajera')
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('stickers')
  await page.getByRole('button', { name: /^Agregar Pack stickers/ }).click()

  // La barra fija muestra el total y abre el cobro
  const bar = page.getByRole('button', { name: 'Cobrar' }).last()
  await expect(bar).toBeVisible()
  await bar.click()
  await page.getByRole('dialog').getByText('Débito').click()
  await page.getByRole('dialog').getByRole('button', { name: /Confirmar/ }).click()
  await expect(page.getByText(/Venta #\d+ registrada/)).toBeVisible()

  // La navegación inferior lleva a "Mis ventas"
  await page.getByRole('navigation', { name: 'Principal' }).last().getByRole('link', { name: 'Ventas' }).click()
  await expect(page.getByRole('heading', { name: 'Mis ventas' })).toBeVisible()
})
