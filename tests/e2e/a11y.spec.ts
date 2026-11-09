import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// NB: `/` esclusa di proposito — dipende da Supabase + mappa,
// in CI non e' deterministica.

test.describe("accessibility (axe)", () => {
  const pages = ["/styleguide", "/~offline", "/submit-court"];

  for (const url of pages) {
    test(`${url} has no axe violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
