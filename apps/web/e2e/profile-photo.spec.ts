import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('cada persona sube su foto de perfil, se ve en la barra lateral y la puede quitar', async ({ page }) => {
  await loginAs(page, 'Encargado')
  await expect(page.getByRole('heading', { name: /Martín/ })).toBeVisible()

  // Una imagen PNG válida y rectangular, generada por el propio navegador (la app la tiene que poder decodificar y recortar).
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 300
      const context = canvas.getContext('2d')!
      context.fillStyle = '#4f46e5'
      context.fillRect(0, 0, 400, 300)
      return canvas.toDataURL('image/png').split(',')[1]!
    }),
    'base64',
  )

  const userButton = page.getByRole('button', { name: /^Menú de / })
  await userButton.click()
  await page.getByRole('button', { name: 'Foto de perfil' }).click()

  const dialog = page.getByRole('dialog', { name: 'Foto de perfil' })
  await dialog.locator('input[type=file]').setInputFiles({ name: 'yo.png', mimeType: 'image/png', buffer: png })
  await dialog.getByRole('button', { name: 'Guardar foto' }).click()
  await expect(page.getByText('Foto actualizada')).toBeVisible()
  await expect(userButton.locator('img')).toHaveAttribute('src', /^data:image\/(webp|jpeg);base64,/)

  // Al recargar, la foto sigue ahí: quedó guardada en la API.
  await page.reload()
  await expect(userButton.locator('img')).toBeVisible()

  await userButton.click()
  await page.getByRole('button', { name: 'Foto de perfil' }).click()
  await dialog.getByRole('button', { name: 'Quitar foto' }).click()
  await expect(page.getByText('Foto quitada')).toBeVisible()
  await expect(userButton.locator('img')).toHaveCount(0)
})
