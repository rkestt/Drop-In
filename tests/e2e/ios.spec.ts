import { test, expect, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
} from "./helpers/auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

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

  test.describe("verifica-eta", () => {
    test.describe.configure({ timeout: 120_000 });

    test("form e blocco stanno nel viewport, niente zoom al focus", async ({
      page,
    }) => {
      test.skip(
        !process.env.E2E_WITH_DB,
        "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test --project=iphone-webkit",
      );
      const errors: string[] = [];

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const user = await createConfirmedUser("-iosage", { birthDate: null });
      try {
        await loginViaUI(page, user);

        // Solo rumore dev nell'emulatore (polling HMR bloccato): mai un
        // errore dell'app. pageerror resta a zero secco.
        const DEV_NOISE = [/hot-update\.json/, /__nextjs_original-stack-frames/];
        page.on("console", (m) => {
          if (m.type() !== "error") return;
          if (DEV_NOISE.some((re) => re.test(m.text()))) return;
          errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));

        // Senza riga `profile_age` il layout rimanda al gate. Nota WebKit:
        // il redirect server interrompe la promise di goto (in Chromium
        // segue in silenzio); la destinazione è comunque raggiunta.
        await page.goto("/").catch(() => {});
        await expect(page).toHaveURL(/\/verifica-eta/, { timeout: 20_000 });

        // Ricarica pulita: la corsa del redirect sporca la console con
        // l'RSC abortito (Load failed + boundary transitoria, pagina finale
        // sempre corretta — la copre age-gate.spec su Chromium). Da qui in
        // poi la console è attribuibile alla pagina.
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "La tua data di nascita" }),
        ).toBeVisible();

        // Si assesta la coda del login (refresh → redirect → fallback):
        // RSC fallito e fetch abortite sono fallout della corsa, non della
        // pagina. Da qui il flusso è tutto locale (sotto i 14 anni non parte
        // nemmeno una fetch), quindi ogni voce dopo è attribuibile.
        await page.waitForLoadState("networkidle");
        errors.length = 0;

        const viewportHeight = page.viewportSize()!.height;
        const noOverflow = () =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
        async function inViewport(name: string, locator: Locator) {
          const box = await locator.boundingBox();
          expect(box, `${name}: ha un box`).not.toBeNull();
          expect(box!.y, `${name}: sopra il bordo`).toBeGreaterThanOrEqual(-1);
          expect(
            box!.y + box!.height,
            `${name}: dentro il viewport`,
          ).toBeLessThanOrEqual(viewportHeight + 1);
        }

        expect(await noOverflow(), "scroll orizzontale sul form").toBeLessThanOrEqual(1);

        const birthInput = page.getByRole("textbox", { name: "Data di nascita" });
        const submit = page.getByRole("button", { name: "Continua" });
        await expect(birthInput).toBeVisible();
        await expect(submit).toBeVisible();

        // A 16px iOS non zooma al focus: si legge dal computed, non a occhio.
        const metrics = await birthInput.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { h: r.height, fontSize: getComputedStyle(el).fontSize };
        });
        expect(metrics.h, "input: altezza").toBeGreaterThanOrEqual(44);
        expect(metrics.fontSize, "input: font-size anti-zoom").toBe("16px");

        await inViewport("data di nascita", birthInput);
        await inViewport("continua", submit);

        // Blocco: entrambe le uscite visibili e raggiungibili, niente
        // vicolo cieco. Il picker nativo non si verifica: non è scriptabile
        // (vedi docs/ios.md su cosa l'emulazione non copre).
        const d = new Date();
        d.setFullYear(d.getFullYear() - 10);
        await birthInput.fill(d.toISOString().slice(0, 10));
        await submit.click();
        const fix = page.getByRole("button", { name: "Correggi la data" });
        const del = page.getByRole("button", { name: "Elimina il mio account" });
        await expect(fix).toBeVisible();
        await expect(del).toBeVisible();
        expect(await noOverflow(), "scroll orizzontale sul blocco").toBeLessThanOrEqual(1);
        await inViewport("correggi la data", fix);
        await inViewport("elimina il mio account", del);

        expect(errors, "eccezioni/errori console sul gate").toEqual([]);
      } finally {
        // Autodistruzione: la riga `profile_age` non esiste (mai scritta),
        // resta solo l'utente.
        try {
          await admin.auth.admin.deleteUser(user.id);
        } catch {
          // best-effort: lo spec ha già detto la sua
        }
      }
    });
  });
});
