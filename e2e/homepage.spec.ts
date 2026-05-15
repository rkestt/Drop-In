import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Drop in/i)
  })

  test('should show map container', async ({ page }) => {
    await page.goto('/')

    const mapContainer = page.locator('#map, [class*="map"], [data-testid="map"]')
    await expect(mapContainer.first()).toBeVisible({ timeout: 10000 })
  })
})