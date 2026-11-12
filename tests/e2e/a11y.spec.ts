import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createConfirmedUser, loginViaUI } from "./helpers/auth";

/** Flag onboarding/coach: su porte diverse da 3100 lo storageState non
 *  combacia e il primo avvio riparte (drawer modale + pagina inert).
 *  Con i flag la pagina è come in CI: nessun overlay. */
async function seedOnboarded(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("dropin:onboarded:v1", "1");
    localStorage.setItem("dropin:coach:check-in", "1");
  });
}
async function dismissOnboarding(page: Page): Promise<void> {
  // Fino a 5 overlay: primo avvio (Salta) + coach mark (Chiudi) + eventuali
  // prompt. Senza, Base UI marca la pagina `inert` e i test tastiera non sono
  // significativi.
  for (let i = 0; i < 5; i++) {
    const skip = page.getByRole("button", { name: "Salta il primo avvio" });
    if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
      continue;
    }
    const coach = page.getByRole("button", { name: "Chiudi il suggerimento" });
    if (await coach.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await coach.click();
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
  // NB: niente Escape cieco qui — chiuderebbe anche drawer legittimi
  // (es. il login) che i test vogliono aperti.
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

// Seed deterministici (stessi di court-detail.spec / browse.spec).
const SEED_COURT = "a4dbc1f9-7db6-47f4-ba39-f5f9e0c0b18e";
const SEED_LOBBY = "028976ab-e825-44dd-8411-0f851ba7361d";

test.describe("accessibility (axe) — statiche, verdi in CI", () => {
  const pages = ["/styleguide", "/~offline", "/submit-court"];

  for (const url of pages) {
    test(`${url} has no axe violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags([...TAGS])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

// `/` in CI non ha Supabase né seed: niente attese sui dati (marker,
// liste). L'axe deve passare anche a mappa vuota; l'esclusione dei marker
// sotto è no-op quando non ce ne sono.
test.describe("accessibility (axe) — home, verde in CI anche senza DB", () => {
  test("/ has no axe violations (marker sovrapposti esclusi)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags([...TAGS])
      // Eccezione documentata (accessibility.md): con dati reali i court
      // vicini si sovrappongono e axe `target-size` li segnala per
      // geometria dei dati, non del codice. Con DB i marker sono coperti
      // dal test dedicato nel describe gateato qui sotto.
      .exclude(".court-marker")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("accessibility (axe) — reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("/ resta leggibile con reduced motion", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#contenuto")).toBeVisible();
    // Nessuna informazione sparisce: la mappa e il riepilogo restano.
    await expect(
      page.getByRole("region", { name: /mappa/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});

// Route con DB: fuori dalla CI finché la CI non ha Supabase (nessun
// webServer riuso qui: girano con E2E_WITH_DB=1 e Supabase locale up).
test.describe("accessibility (axe) — autenticate (E2E_WITH_DB)", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/a11y.spec.ts",
  );
  test.describe.configure({ mode: "serial" });
  // Admin API + login via UI + salvataggio stato: alza il tetto (vale anche per il beforeAll).
  test.setTimeout(120_000);

  const AUTH_STATE = "/tmp/opencode/a11y-auth.json";

  test.beforeAll(async ({ browser }) => {
    const user = await createConfirmedUser();
    // storageState esplicito vuoto: senza, newPage eredita il test.use
    // del describe interno e fallisce perché il file non esiste ancora.
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

    const authed = [
      "/profile",
      "/settings",
      "/notifications",
      "/lobbies",
      `/lobbies/${SEED_LOBBY}`,
      `/courts/${SEED_COURT}`,
    ];

    for (const url of authed) {
      test(`${url} has no axe violations`, async ({ page }) => {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page })
          .withTags([...TAGS])
          .exclude(".court-marker")
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }

    // #65: il filtro sport non è più invisibile: la tab Vicine mostra la pill
    // con etichetta esplicita anche prima che la geolocalizzazione risponda.
    test("tab Vicine: filtro sport visibile ed etichettato", async ({ page }) => {
      await page.goto("/lobbies?tab=nearby");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Filtra per sport")).toBeVisible();
      // L'id è generato da useId (una istanza per pagina): si aggancia il
      // nome accessibile, non un id interno.
      const select = page.getByRole("combobox", { name: "Sport attivo" });
      await expect(select).toBeVisible();
      await expect(select).toHaveAccessibleName("Sport attivo");
    });

    test("skip link anche su /settings", async ({ page }) => {
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#contenuto")).toBeFocused();
    });

    // Questi test vogliono il DB con seed: non girano in CI.
    test("i marker sono operabili da tastiera e nominati", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const first = page.locator(".court-marker").first();
      await first.waitFor({ timeout: 20_000 });
      await expect
        .poll(async () => page.locator(".court-marker").count(), {
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
      await expect(first).toHaveAttribute("role", "button");
      await expect(first).toHaveAttribute("tabindex", "0");
      const label = await first.getAttribute("aria-label");
      expect(label).toMatch(/^Campo: .+/);
      // Focus visibile: l'anello del progetto, non outline:none secco.
      await first.focus();
      await expect(first).toBeFocused();
      // Attivazione reale: Invio naviga alla scheda campo.
      await first.press("Enter");
      await page.waitForURL(/\/courts\/[0-9a-f-]+$/, { timeout: 15_000 });
    });

    test("skip link: primo Tab, apre il contenuto", async ({ page }) => {
      await seedOnboarded(page);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await dismissOnboarding(page);
      const skip = page.getByRole("link", { name: "Vai al contenuto" });
      await page.keyboard.press("Tab");
      await expect(skip).toBeFocused();
      // Visibile solo al focus (sr-only → not-sr-only).
      await expect(skip).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator("#contenuto")).toBeFocused();
    });

    test("login via tastiera: compila e invia con Enter", async ({ page }) => {
      await seedOnboarded(page);
      await page.goto("/?login=required");
      await page.waitForLoadState("networkidle");
      await dismissOnboarding(page);
      const email = page.getByLabel("Indirizzo email");
      await email.waitFor({ timeout: 15_000 });
      // Percorso interamente da tastiera: Tab fino al campo, digita, invia.
      await email.focus();
      await page.keyboard.type("non-esiste@dropin.test");
      await page.keyboard.press("Tab");
      await page.keyboard.type("password-errata");
      await page.keyboard.press("Enter");
      // Esito annunciato: errore con role=alert + aria-live (login-modal).
      await expect(page.getByRole("alert").first()).toBeVisible({
        timeout: 15_000,
      });
      const results = await new AxeBuilder({ page })
        .withTags([...TAGS])
        .exclude(".court-marker")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
});
