import { test, expect } from "@playwright/test";

// Visual regression sulle sezioni stabili della styleguide.
// Le sezioni "Componenti" e "Librerie" restano fuori: contengono controlli
// interattivi e portal, che producono altezze diverse tra locale e CI.
const SECTIONS = ["colori", "scale"] as const;

test.describe("styleguide visual regression", () => {
  const viewports = [
    { width: 360, height: 900 },
    { width: 768, height: 1000 },
    { width: 1280, height: 1000 },
  ];

  for (const { width, height } of viewports) {
    test(`styleguide @ ${width}px sections match baseline`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/styleguide");
      await expect(
        page.getByRole("heading", { name: "Styleguide" }),
      ).toBeVisible();
      // I font sono locali: attendere il caricamento prima dello screenshot.
      // L'asserzione sul font evita il falso verde visto in d3: se `next/font/local`
      // non applica i font, il body ricade sul system sans e le baseline
      // restano identiche tra loro pur non essendo il rendering vero.
      await page.evaluate(() => document.fonts.ready);
      const bodyFont = await page.evaluate(() =>
        getComputedStyle(document.body).fontFamily.toLowerCase(),
      );
      // next/font normalizza il nome della famiglia in `sourceSans`
      expect(bodyFont).toMatch(/source\s?sans/);

      for (const id of SECTIONS) {
        const section = page.locator(`#${id}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`styleguide-${width}-${id}.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      }
    });
  }
});
