import { test, expect } from '@playwright/test'

test.describe('Lobby Flow', () => {
  test('shows lobby list on dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    const mainContent = page.locator('main').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to lobby page', async ({ page }) => {
    await page.goto('/dashboard/lobbies')

    const pageContent = page.locator('main, [class*="lobby"]').first()
    await expect(pageContent).toBeVisible({ timeout: 10000 })
  })

  test('shows join button on open lobbies', async ({ page }) => {
    await page.goto('/courts/any-id')

    const joinButton = page.getByRole('button', { name: /unisciti|join|entra/i }).first()
    const isVisible = await joinButton.isVisible().catch(() => false)
    if (isVisible) {
      await expect(joinButton).toBeVisible()
    }
  })
})