import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('el buscador rápido (Ctrl + K) encuentra un producto y lo abre con el teclado', async ({ page }) => {
  await loginAs(page, 'Dueña')
  // Esperar a que la app esté montada: recién ahí escucha el atajo de teclado.
  await expect(page.getByRole('heading', { name: /Laura/ })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')

  const search = page.getByRole('combobox')
  await expect(search).toBeFocused()
  await search.fill('remera box')
  await expect(page.getByRole('option', { name: /Remera Box Flame · L/ })).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/productos\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: /Remera Box Flame/ })).toBeVisible()
})

test('el buscador rápido lleva a una sección y respeta los permisos del rol', async ({ page }) => {
  await loginAs(page, 'Cajera')
  await page.getByRole('button', { name: /Buscar/ }).click()
  await page.getByRole('combobox').fill('reportes')
  // La cajera no ve reportes: la sección no aparece en el buscador.
  await expect(page.getByRole('option', { name: 'Reportes' })).toHaveCount(0)

  await page.getByRole('combobox').fill('ventas')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/ventas')
})
