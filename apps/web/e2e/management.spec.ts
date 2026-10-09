import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('el encargado aplica un aumento masivo con vista previa', async ({ page }) => {
  await loginAs(page, 'Encargado')
  await page.goto('/precios')

  await page.getByRole('button', { name: 'Productos' }).click()
  await page.getByRole('option', { name: 'Accesorios (8)' }).click()
  await page.getByLabel('Porcentaje').fill('10')
  // Ejemplo de la pantalla: $34.900 + 10 % = $38.390
  await expect(page.getByText('Ejemplo: un producto de')).toContainText('$ 38.390,00')
  await page.getByRole('button', { name: 'Ver vista previa' }).click()

  await expect(page.getByText('8 de 8 productos seleccionados')).toBeVisible()
  // Cera $8.900 + 10 % = $9.790 (ya es múltiplo de $10)
  await expect(page.getByRole('row', { name: /Cera para curb/ })).toContainText('$ 9.790,00')

  await page.getByRole('checkbox', { name: 'Incluir Cera para curb' }).uncheck()
  await page.getByRole('button', { name: 'Aplicar a 7 productos' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, aplicar' }).click()
  await expect(page.getByText('Listo: se actualizaron 7 productos')).toBeVisible()
})

test('ajustar stock por recuento queda en el historial', async ({ page }) => {
  await loginAs(page, 'Encargado')
  await page.goto('/productos')
  await page.getByLabel('Buscar productos').fill('llave')
  await page.getByRole('link', { name: 'Llave en T multiuso' }).click()

  await page.getByRole('button', { name: 'Ajustar stock' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Recuento').click()
  await dialog.getByLabel('Unidades contadas').fill('42')
  await dialog.getByRole('button', { name: 'Registrar movimiento' }).click()

  await expect(page.getByText('Stock actualizado: 42 unidades')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Recuento' }).first()).toContainText('42')
})

test('la dueña crea un producto nuevo', async ({ page }) => {
  await loginAs(page, 'Dueña')
  await page.goto('/productos')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()

  const dialog = page.getByRole('dialog', { name: 'Nuevo producto' })
  await dialog.getByLabel('Nombre').fill('Remera Ruido Grafiti negra · M')
  await dialog.getByLabel('Código (SKU)').fill('rem-99-m')
  await dialog.getByLabel('Costo').fill('15000')
  await dialog.getByLabel('Precio de venta').fill('34.900')
  await dialog.getByLabel('Stock inicial').fill('6')
  await expect(dialog).toContainText('57 %')
  await dialog.getByRole('button', { name: 'Crear producto' }).click()

  await expect(page.getByRole('heading', { name: 'Remera Ruido Grafiti negra · M' })).toBeVisible()
  await expect(page.getByText('REM-99-M')).toBeVisible()
})
