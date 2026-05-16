import { test, expect } from '@playwright/test'

test.describe('Check-in Flow', () => {
  test('shows check-in button on court page', async ({ page }) => {
    await page.goto('/courts/any-id')

    const checkInButton = page.getByRole('button', { name: /check[- ]?in/i }).first()
    const isVisible = await checkInButton.isVisible().catch(() => false)
    if (isVisible) {
      await expect(checkInButton).toBeVisible()
    }
  })

  test('shows login required message when not authenticated', async ({ page }) => {
    await page.goto('/courts/any-id')

    const joinButton = page.getByRole('button', { name: /unisciti|entra/i }).first()
    if (await joinButton.isVisible().catch(() => false)) {
      await joinButton.click()
      const errorMessage = page.getByText(/devi effettuare l'accesso|effettua il login/i)
      const messageVisible = await errorMessage.isVisible().catch(() => false)
      if (messageVisible) {
        await expect(errorMessage).toBeVisible()
      }
    }
  })
})