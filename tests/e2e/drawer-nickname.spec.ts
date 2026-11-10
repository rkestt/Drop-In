import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createConfirmedUser, loginViaUI } from "./helpers/auth";

// Drawer "Modifica nickname": focus iniziale, trap, restore (finding @tester).
// Vuole un utente loggato: stesso pattern E2E_WITH_DB di a11y.spec.ts.
test.describe("drawer nickname — focus", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/drawer-nickname.spec.ts",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const AUTH_STATE = "/tmp/opencode/nickname-auth.json";

  test.beforeAll(async ({ browser }) => {
    const user = await createConfirmedUser("-nick");
    const page = await browser.newPage({
      storageState: { cookies: [], origins: [] },
    });
    try {
      await loginViaUI(page, user);
      await page.context().storageState({ path: AUTH_STATE });
    } finally {
      await page.close();
    }
  });

  test.describe("con sessione", () => {
    test.use({ storageState: AUTH_STATE });

    test("apertura → focus sul campo, trap, Esc → focus sul trigger", async ({
      page,
    }) => {
      await page.goto("/profile");
      await page.waitForLoadState("networkidle");
      const trigger = page
        .getByRole("button", { name: "Modifica" })
        .or(page.getByRole("button", { name: "Imposta nickname" }))
        .first();
      await trigger.waitFor({ timeout: 15_000 });
      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      const field = page.getByLabel("Nickname");
      // 1. Focus iniziale sul campo, senza Tab.
      await expect
        .poll(async () => page.evaluate(() => document.activeElement?.id), {
          timeout: 15_000,
        })
        .toBe("profile-nickname");
      await expect(field).toBeFocused();
      // Il trap Base UI ingaggia dopo il focus iniziale: breve settle o il
      // primo Tab può partire prima che le guardie siano montate (flake).
      await page.waitForTimeout(500);

      // 2. Trap: 5 Tab + 2 Shift+Tab restano dentro il dialog.
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(150);
        expect(
          await page.evaluate(() => {
            const d = document.querySelector('[role="dialog"]');
            return !!d?.contains(document.activeElement);
          }),
        ).toBe(true);
      }
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press("Shift+Tab");
        await page.waitForTimeout(150);
        expect(
          await page.evaluate(() => {
            const d = document.querySelector('[role="dialog"]');
            return !!d?.contains(document.activeElement);
          }),
        ).toBe(true);
      }

      // Sanità axe sul drawer aperto.
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude(".court-marker")
        .analyze();
      expect(results.violations).toEqual([]);

      // 3. Esc chiude e il focus torna sul trigger.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      await expect(trigger).toBeFocused();
    });
  });
});
