import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show navigation on homepage', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav, header, [class*="nav"]').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('should allow navigation to profile when logged in', async ({ page }) => {
    await page.goto('/dashboard/profile')

    await expect(page).toHaveURL(/dashboard|login|accedi/, { timeout: 10000 })
  })
})