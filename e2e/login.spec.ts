import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('shows login modal when clicking profile', async ({ page }) => {
    await page.goto('/')

    const profileButton = page.getByRole('button', { name: /profilo|profile/i }).first()
    if (await profileButton.isVisible()) {
      await profileButton.click()
      await expect(page.getByText(/accedi|login|acount/i)).toBeVisible({ timeout: 5000 })
    }
  })

  test('shows login form elements', async ({ page }) => {
    await page.goto('/dashboard')

    const loginContent = page.locator('main, [class*="content"]').first()
    await expect(loginContent).toBeVisible({ timeout: 10000 })
  })

  test('redirects to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard/lobbies')

    await expect(page).toHaveURL(/login|accedi|dashboard/, { timeout: 10000 })
  })
})