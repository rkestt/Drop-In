import { test, expect } from "@playwright/test";
import { createConfirmedUser, loginViaUI } from "./helpers/auth";

// Riga "Notifiche push" in Impostazioni (#25): unica copertura autenticata di
// /settings. Verifica che la pagina non esploda (il provider push deve
// avvolgere l'albero: fuori dal provider `usePushNotifications` lancia) e che
// senza `NEXT_PUBLIC_VAPID_PUBLIC_KEY` la riga dica la verità — nessun finto
// switch, una sola switch in pagina (quella del pallino avvisi).
test.describe("settings — riga push", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/settings-push.spec.ts",
  );
  test.setTimeout(120_000);

  test("la riga push è onesta e la pagina non esplode", async ({
    browser,
  }) => {
    const user = await createConfirmedUser("-pushrow");
    const page = await browser.newPage({
      viewport: { width: 360, height: 800 },
      storageState: { cookies: [], origins: [] },
    });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    try {
      await loginViaUI(page, user);
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByText("Notifiche push", { exact: true }),
      ).toBeVisible();
      // Senza chiave VAPID (locale di default) lo stato è "missing-key":
      // la riga resta non interattiva e lo dice.
      await expect(
        page.getByText(/non sono attive in questa versione/i).first(),
      ).toBeVisible();
      expect(await page.getByRole("switch").count()).toBe(1);

      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(
        page.getByText("Notifiche push", { exact: true }),
      ).toBeVisible();

      expect(errors, `errori console: ${errors.join(" | ")}`).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
