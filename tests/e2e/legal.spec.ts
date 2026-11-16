import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * #83: pagine legali raggiungibili, link incrociati e accessibili.
 * Test statici: girano anche in CI, senza Supabase.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

const PAGES = [
  { href: "/legal", heading: "Documenti legali" },
  { href: "/legal/privacy", heading: "Informativa privacy" },
  { href: "/legal/terms", heading: "Termini di servizio" },
  { href: "/legal/cookies", heading: "Cookie e memorizzazione locale" },
];

test.describe("documenti legali (#83)", () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.href}: h1, skip target e axe verdi`, async ({ page }) => {
      const response = await page.goto(pageInfo.href);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: pageInfo.heading })
      ).toBeVisible();
      // Il contenuto è raggiungibile dallo skip link (stesso contratto dei
      // main dei gruppi app/dashboard).
      await expect(page.locator("#contenuto")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags([...TAGS])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("indice: i tre documenti sono linkati e si apre ognuno", async ({
    page,
  }) => {
    await page.goto("/legal");
    for (const href of ["/legal/privacy", "/legal/terms", "/legal/cookies"]) {
      const link = page.locator(`a[href="${href}"]`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      // Ogni documento torna all'indice senza dipendere dal browser.
      await page.getByRole("link", { name: "Documenti legali" }).click();
      await expect(page).toHaveURL(/\/legal$/);
    }
  });

  test("nessun placeholder dei testi legali nei documenti pubblicati", async ({
    request,
  }) => {
    // I placeholder sono ammessi solo dove dichiarano cosa manca, e devono
    // sparire prima della pubblicazione. Qui si limita il controllo a ciò
    // che NON deve comparire: istruzioni interne o TODO di sviluppo.
    for (const { href } of PAGES) {
      const res = await request.get(href);
      const html = await res.text();
      expect(html, href).not.toContain("TODO");
      expect(html, href).not.toContain("lorem ipsum");
    }
  });
});
