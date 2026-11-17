import { test, expect } from "@playwright/test";

/**
 * Giro minimo sul motore di Safari con profilo iPhone (progetto `iphone-webkit`).
 *
 * Perché esiste: Chromium non riproduce `dvh`, `inert` e il touch di iOS. Questi
 * check sono strutturali (niente snapshot): quando il foglio delle partite (#89)
 * arriva nell'app, qui si aggiungono altezze, gesto e la testa che sparisce.
 * Cosa l'emulazione non copre: `docs/ios.md`.
 */

test.describe("iPhone (WebKit)", () => {
  test.beforeEach(async ({ page }) => {
    // Niente primo avvio: i drawer renderebbero la pagina `inert`.
    await page.addInitScript(() => {
      localStorage.setItem("dropin:onboarded:v1", "1");
      localStorage.setItem("dropin:coach:check-in", "1");
    });
  });

  test("home: sta nel viewport e la nav è a portata di pollice", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navigazione principale" });
    await expect(nav).toBeVisible({ timeout: 20_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "scroll orizzontale sulla home").toBeLessThanOrEqual(1);

    const targets = await nav.locator("a").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute("aria-label") ?? "", w: Math.round(r.width), h: Math.round(r.height) };
      })
    );
    expect(targets.length).toBeGreaterThanOrEqual(2);
    for (const t of targets) {
      expect(t.w, `${t.label}: larghezza`).toBeGreaterThanOrEqual(44);
      expect(t.h, `${t.label}: altezza`).toBeGreaterThanOrEqual(44);
    }

    // La nav sta sopra il bordo inferiore: su iPhone il pollice arriva qui.
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);

    expect(errors, "eccezioni JS sulla home").toEqual([]);
  });
});
