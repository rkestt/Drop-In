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
// liste). L'axe deve passare anche a mappa vuota.
test.describe("accessibility (axe) — home, verde in CI anche senza DB", () => {
  test("/ has no axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags([...TAGS])
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

// #29: focus trap e focus restore nei drawer/sheet. Un Drawer di progetto
// (Base UI, modal) copre login, primo avvio, check-in, modifica profilo e
// anteprima campo: qui si fissa il contratto sul caso statico (login).
test.describe("accessibility — drawer: focus trap e restore", () => {
  test("Tab/Shift+Tab restano nel dialog, Escape chiude e torna al trigger", async ({
    page,
  }) => {
    await seedOnboarded(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);

    const trigger = page.getByRole("button", { name: "Accedi" }).first();
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // Il focus entra nel dialog all'apertura (Base UI applica initialFocus).
    const inDialog = () =>
      page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null
      );
    expect(await inDialog()).toBe(true);

    // Giro completo in avanti: nessun Tab esce dal dialog.
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Tab");
      expect(await inDialog(), `Tab #${i + 1} uscito dal dialog`).toBe(true);
    }
    // ... e all'indietro, incluso il wrap dal primo elemento.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await inDialog(), `Shift+Tab #${i + 1} uscito dal dialog`).toBe(
        true
      );
    }

    // Il contenuto sotto è inerte: la pagina non è raggiungibile da tastiera.
    const navFocusable = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navigazione principale"]');
      if (!nav) return 0;
      return nav.querySelectorAll("a[href], button:not([disabled])").length;
    });
    expect(navFocusable).toBeGreaterThan(0);

    // Escape chiude e il focus torna al bottone che l'ha aperto.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(trigger).toBeFocused();
  });
});

// #29: target touch 44px sulle superfici interattive della mappa (view 360px).
test.describe("accessibility — touch target 44px (360px)", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("nav, CTA e controlli mappa sono almeno 44x44", async ({ page }) => {
    await seedOnboarded(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    // La mappa è lazy: i controlli MapLibre compaiono solo dopo il mount del
    // chunk. Senza questa attesa il test è flaky sotto carico (verificato in
    // una run parallela: count 0).
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toBeVisible({
      timeout: 20_000,
    });

    // Attribuzione mappa: i link sono testo inline dentro una frase, quindi
    // l'eccezione WCAG 2.2 SC 2.5.8 (inline) si applica — 14px di altezza
    // non sono un target autonomo. Il test copre solo i target veri.
    //
    // "Lista campi" esiste solo quando ci sono campi nel raggio: in CI (senza
    // Supabase) non c'è, quindi si misura solo con E2E_WITH_DB. I target
    // sempre presenti vanno invece pretesi, altrimenti il test passerebbe
    // vuoto su un layout rotto.
    const alwaysTargets = [
      'nav[aria-label="Navigazione principale"] a',
      'a[aria-label="Aggiungi un campo"]',
      ".maplibregl-ctrl-zoom-in",
      ".maplibregl-ctrl-zoom-out",
      'input[type="search"]',
      'button:has-text("Accedi")',
    ];
    const targets = process.env.E2E_WITH_DB
      ? [...alwaysTargets, 'button:has-text("Lista campi")']
      : alwaysTargets;
    for (const selector of targets) {
      const elements = page.locator(selector);
      const count = await elements.count();
      expect(count, `nessun elemento per ${selector}`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (!(await el.isVisible())) continue;
        const box = await el.boundingBox();
        expect(box, `${selector}[${i}] senza box`).not.toBeNull();
        // Tolleranza 0.5px: il layout subpixel a 360px arrotonda.
        expect(box!.width, `${selector}[${i}] largo ${box!.width}`).toBeGreaterThanOrEqual(43.5);
        expect(box!.height, `${selector}[${i}] alto ${box!.height}`).toBeGreaterThanOrEqual(43.5);
      }
    }
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
    test("mappa: un tab stop, lista campi e anteprima da tastiera", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // La superficie mappa è un solo ingresso da tastiera: il canvas è
      // decorativo, i tasti li gestisce il contenitore (#44).
      const mapSurface = page.getByRole("group", {
        name: "Area mappa interattiva",
      });
      await expect(mapSurface).toBeVisible({ timeout: 20_000 });
      await mapSurface.focus();
      await expect(mapSurface).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("+");
      await page.keyboard.press("Home");

      // Lista dei campi visibili: bottone sulla mappa, dialog non modale.
      const listButton = page.getByRole("button", { name: /Lista campi/i });
      await expect(listButton).toBeVisible({ timeout: 20_000 });
      await listButton.focus();
      await page.keyboard.press("Enter");

      const list = page.getByRole("dialog", { name: /Lista campi/i });
      await expect(list).toBeVisible();
      const firstItem = list.locator("li button").first();
      await expect(firstItem).toBeFocused();

      // Invio: anteprima senza reload, nome del campo e CTA client.
      await page.keyboard.press("Enter");
      const openDetail = page.getByRole("link", { name: "Apri dettaglio" });
      await expect(openDetail).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(mapSurface).toBeFocused();

      // La CTA resta una navigazione client, non un full reload.
      await listButton.focus();
      await page.keyboard.press("Enter");
      await firstItem.focus();
      await page.keyboard.press("Enter");
      await openDetail.click();
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
      // Esito annunciato: errore con role=alert dentro il dialog di login.
      // Circoscritto al dialog: la home ha già un `role="alert"` suo (errore
      // geolocalizzazione della mappa), e `.first()` lo prendeva, lasciando
      // passare l'asserzione mentre il form stava ancora inviando.
      const loginDialog = page.getByRole("dialog");
      await expect(loginDialog.getByRole("alert")).toBeVisible({
        timeout: 15_000,
      });
      // Il submit è `disabled:opacity-50` con `transition-all duration-150`:
      // misurato a metà dissolvenza il bottone dà contrasto 3.13 invece di
      // 5.2 e axe lo segnala (caduto una volta il 2026-11-18). Si aspetta la
      // fine della transizione, non un tempo fisso.
      await expect(
        loginDialog.getByRole("button", { name: /Accedi|Entra/i }).first(),
      ).toHaveCSS("opacity", "1", { timeout: 10_000 });
      const results = await new AxeBuilder({ page })
        .withTags([...TAGS])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    // #29: contrasto "runtime" dei componenti nuovi. L'anteprima campo è un
    // bottom sheet con foto, badge e CTA: axe la controlla aperta, non solo
    // nello stato chiuso della pagina. Il trap è già fissato nel test mappa;
    // qui si controlla che Tab non scappi dal dialog.
    test("anteprima campo: axe con sheet aperto, Tab resta dentro", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const listButton = page.getByRole("button", { name: /Lista campi/i });
      await expect(listButton).toBeVisible({ timeout: 20_000 });
      await listButton.focus();
      await page.keyboard.press("Enter");
      const list = page.getByRole("dialog", { name: /Lista campi/i });
      await expect(list).toBeVisible();
      await list.locator("li button").first().focus();
      await page.keyboard.press("Enter");

      const sheet = page.getByRole("dialog").filter({
        has: page.getByRole("link", { name: "Apri dettaglio" }),
      });
      await expect(sheet).toBeVisible({ timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags([...TAGS])
        .analyze();
      expect(results.violations).toEqual([]);

      const inSheet = () =>
        page.evaluate(() => {
          const dialogs = document.querySelectorAll('[role="dialog"]');
          const active = document.activeElement;
          return Array.from(dialogs).some((d) => active && d.contains(active));
        });
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        expect(await inSheet(), `Tab #${i + 1} fuori dall'anteprima`).toBe(true);
      }
    });
  });
});
