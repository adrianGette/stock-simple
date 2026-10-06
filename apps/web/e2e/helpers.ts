import { type Page, expect } from '@playwright/test'

export type DemoRole = 'Dueña' | 'Encargado' | 'Cajera'

/** Ingresa con los accesos rápidos de la demo, igual que un visitante del portfolio. */
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  await page.goto('/ingresar')
  await page.getByRole('button', { name: new RegExp(`^${role}`) }).click()
  await expect(page).not.toHaveURL(/ingresar/)
}
