import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('el desplegable propio se usa con el teclado como un select nativo', async ({ page }) => {
  await loginAs(page, 'Dueña')
  await page.goto('/ventas')

  const payment = page.getByRole('button', { name: 'Medio de pago' })
  await payment.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox', { name: 'Medio de pago' })).toBeVisible()

  // Una letra salta a la opción que empieza con ella; Enter la elige y cierra la lista.
  await page.keyboard.press('d')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/pago=DEBIT/)
  await expect(payment).toHaveText('Débito')
  await expect(payment).toBeFocused()
  await expect(page.getByRole('listbox', { name: 'Medio de pago' })).toBeHidden()

  // Esc cierra sin cambiar nada.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(payment).toHaveText('Débito')
})

test('el desplegable funciona con el mouse dentro de un diálogo y el formulario recibe el valor', async ({ page }) => {
  await loginAs(page, 'Dueña')
  await page.goto('/productos')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()

  const dialog = page.getByRole('dialog', { name: 'Nuevo producto' })
  await dialog.getByRole('button', { name: /Categoría/ }).click()
  await page.getByRole('option', { name: 'Remeras' }).click()
  await expect(dialog.getByRole('button', { name: /Categoría/ })).toHaveText('Remeras')
})
