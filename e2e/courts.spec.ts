import { test, expect } from '@playwright/test'

test.describe('Court Detail Page', () => {
  test.skip('should show login prompt when accessing lobby without auth (requires DB)', async ({ page }) => {
    await page.goto('/courts/test-court-id')
    await expect(page.getByText(/accedi|effettua l|accesso/i).first()).toBeVisible({ timeout: 10000 })
  })

  test.skip('should display court name when visiting (requires DB)', async ({ page }) => {
    await page.goto('/courts/test-court-id')
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })
})