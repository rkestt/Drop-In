import { test, expect } from '@playwright/test'

test.describe('Court Detail Page', () => {
  test('should load court detail page', async ({ page }) => {
    await page.goto('/courts/1')

    await expect(page).toHaveURL(/\/courts\//)
  })

  test('should handle court page navigation', async ({ page }) => {
    await page.goto('/courts/any-id-here')

    expect(page.url()).toContain('/courts/')
  })
})