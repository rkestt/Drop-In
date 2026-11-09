import { test, expect } from "@playwright/test";

test.describe("styleguide visual regression", () => {
  const viewports = [
    { width: 360, height: 900 },
    { width: 768, height: 1000 },
    { width: 1280, height: 1000 },
  ];

  for (const { width, height } of viewports) {
    test(`styleguide @ ${width}px matches baseline`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/styleguide");
      await expect(
        page.getByRole("heading", { name: "Styleguide" }),
      ).toBeVisible();
      // I token si leggono a runtime: lascia assestare font/layout
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`styleguide-${width}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
