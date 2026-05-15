import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.skip('should open login modal when clicking login (requires DB)', async ({ page }) => {
    await page.goto('/')
    const loginButton = page.getByRole('button', { name: /profilo|accedi/i }).first()
    if (await loginButton.isVisible()) {
      await loginButton.click()
      await expect(page.getByText(/accedi con google|email/i)).toBeVisible({ timeout: 5000 })
    }
  })

  test.skip('should show login prompt when trying to favorite without auth (requires DB)', async ({ page }) => {
    await page.goto('/')
    const favoriteButton = page.locator('[class*="favorite"], [class*="heart"]').first()
    if (await favoriteButton.isVisible()) {
      await favoriteButton.click()
      await expect(page.getByText(/accedi|effettua l|accesso/i)).toBeVisible({ timeout: 5000 })
    }
  })
})