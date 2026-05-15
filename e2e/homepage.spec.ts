import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Drop in/i)
  })

  test('should show main content', async ({ page }) => {
    await page.goto('/')

    const mainContent = page.locator('main').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should have mobile navigation', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
  })
})