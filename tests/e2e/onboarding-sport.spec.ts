import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";
import { createConfirmedUser, loginViaUI } from "./helpers/auth";

// #45 — primo passo dell'onboarding: scelta dello sport a chip.
// Primo avvio e già-visto girano senza database (come gli axe statici in
// a11y.spec.ts); la sezione impostazioni richiede la sessione e sta dietro
// E2E_WITH_DB come il blocco "autenticate" di a11y.spec.ts.

test.describe("onboarding sport", () => {
  // Primo avvio: localStorage vuoto, nessun flag (stesso shape di
  // helpers/auth.ts e a11y.spec.ts, ma svuotato).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("first run: step sport, Inizia, persistenza, niente riapertura", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Che sport giochi?" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Passo 1 di 4", { exact: true })).toBeVisible();

    const tennis = page.getByRole("radio", { name: "Tennis" });
    await tennis.click();
    await expect(tennis).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Inizia" }).click();
    await expect(
      page.getByRole("heading", { name: "Trova il campo più vicino" }),
    ).toBeVisible();

    const skip = page.getByRole("button", { name: "Salta il primo avvio" });
    if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skip.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(
      page.getByRole("heading", { name: "Che sport giochi?" }),
    ).toBeHidden({ timeout: 5_000 });

    const sport = page.getByRole("combobox", { name: "Sport attivo" });
    await expect(sport).toBeVisible({ timeout: 15_000 });
    await expect(sport).toHaveValue("tennis");

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Sport attivo" })).toHaveValue(
      "tennis",
      { timeout: 15_000 },
    );
    await expect(
      page.getByRole("heading", { name: "Che sport giochi?" }),
    ).toHaveCount(0);

    tracker.assertClean();
  });

  test("step sport: frecce e Home/End spostano selezione e focus", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/");

    const basket = page.getByRole("radio", { name: "Basket", exact: true });
    await expect(basket).toHaveAttribute("aria-checked", "true", {
      timeout: 15_000,
    });
    await basket.focus();

    const calcio = page.getByRole("radio", { name: "Calcio", exact: true });
    await page.keyboard.press("ArrowRight");
    await expect(calcio).toHaveAttribute("aria-checked", "true");
    await expect(calcio).toBeFocused();

    const tutti = page.getByRole("radio", { name: "Tutti", exact: true });
    await page.keyboard.press("End");
    await expect(tutti).toHaveAttribute("aria-checked", "true");
    await expect(tutti).toBeFocused();

    await page.keyboard.press("Home");
    await expect(basket).toHaveAttribute("aria-checked", "true");
    await expect(basket).toBeFocused();

    tracker.assertClean();
  });

  test("already onboarded: drawer never opens", async ({ page }) => {
    const tracker = await trackConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem("dropin:onboarded:v1", "1");
      localStorage.setItem("dropin:coach:check-in", "1");
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Partite vicine" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Che sport giochi?" }),
    ).toHaveCount(0);
    tracker.assertClean();
  });
});

test.describe("onboarding sport — settings (E2E_WITH_DB)", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/onboarding-sport.spec.ts",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const AUTH_STATE = "/tmp/opencode/onboarding-sport-auth.json";

  test.beforeAll(async ({ browser }) => {
    const user = await createConfirmedUser();
    const page = await browser.newPage({
      storageState: { cookies: [], origins: [] },
    });
    try {
      await loginViaUI(page, user);
      await page.evaluate(() => {
        localStorage.setItem("sport", "tennis");
      });
      await page.context().storageState({ path: AUTH_STATE });
    } finally {
      await page.close();
    }
  });

  test.describe("con sessione", () => {
    test.use({ storageState: AUTH_STATE });

    test("settings: sezione Sport con Tennis checked", async ({ page }) => {
      const tracker = await trackConsoleErrors(page);
      await page.goto("/settings");
      await expect(
        page.getByRole("heading", { name: "Impostazioni" }),
      ).toBeVisible({ timeout: 15_000 });
      const tennis = page.getByRole("radio", { name: "Tennis" });
      await expect(tennis).toBeVisible();
      await expect(tennis).toHaveAttribute("aria-checked", "true");
      tracker.assertClean();
    });
  });
});
