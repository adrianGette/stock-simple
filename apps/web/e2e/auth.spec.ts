import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('la dueña aterriza en el tablero y ve todas las secciones', async ({ page }) => {
  await loginAs(page, 'Dueña')
  await expect(page).toHaveURL('/inicio')
  await expect(page.getByRole('heading', { name: /Laura/ })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Principal' }).first()
  for (const section of ['Vender', 'Productos', 'Precios', 'Reportes', 'Equipo']) {
    await expect(nav.getByRole('link', { name: section })).toBeVisible()
  }
})

test('la cajera va directo a vender y no accede a reportes', async ({ page }) => {
  await loginAs(page, 'Cajera')
  await expect(page).toHaveURL('/vender')
  await expect(page.getByRole('link', { name: 'Reportes' })).toHaveCount(0)

  await page.goto('/reportes')
  await expect(page).toHaveURL('/vender')
})

test('la sesión sobrevive a una recarga y se puede cerrar', async ({ page }) => {
  await loginAs(page, 'Encargado')
  await page.reload()
  await expect(page).toHaveURL('/inicio')

  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/ingresar/)
  await page.goto('/productos')
  await expect(page).toHaveURL(/ingresar/)
})

test('credenciales inválidas muestran un error claro', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Email').fill('duena@stocksimple.demo')
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos')
})
