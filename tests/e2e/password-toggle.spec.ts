import { test, expect, type Locator, type Page } from "@playwright/test";

// #74 — mostra/nascondi password nel LoginModal. Login e registrazione usano
// lo stesso campo, quindi lo stesso toggle. Nessun database: si apre il drawer
// dalla home da anonimi e non si invia mai il form.

const PASSWORD = "segreta-123";

async function openLoginModal(page: Page): Promise<void> {
  // Onboarding e coach già visti: senza, il drawer di primo avvio si apre
  // sopra il login e Base UI marca il form `inert` (vedi helpers/auth.ts).
  await page.addInitScript(() => {
    localStorage.setItem("dropin:onboarded:v1", "1");
    localStorage.setItem("dropin:coach:check-in", "1");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByLabel("Indirizzo email")).toBeVisible({ timeout: 15_000 });
  // Transizioni Base UI del drawer completate prima di misurare i target
  // (stessa attesa di drawer.spec.ts).
  await page.waitForTimeout(600);
}

// `exact`: il nome accessibile del toggle contiene comunque "password".
function passwordField(page: Page): Locator {
  return page.getByLabel("Password", { exact: true });
}

async function expectToggle(
  page: Page,
  name: "Mostra password" | "Nascondi password",
  pressed: boolean
): Promise<Locator> {
  const toggle = page.getByRole("button", { name });
  await expect(toggle).toHaveAttribute("aria-pressed", String(pressed));
  return toggle;
}

test.describe("login e registrazione: toggle mostra/nascondi password", () => {
  test("inverte type e nome, conserva valore e focus, target 44px a 360px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openLoginModal(page);

    const password = passwordField(page);
    await password.fill(PASSWORD);
    await expect(password).toHaveAttribute("aria-label", "Password");
    await expect(password).toHaveAttribute("type", "password");

    const show = await expectToggle(page, "Mostra password", false);
    // Mai submit: il form si invia solo con il bottone sotto il campo.
    await expect(show).toHaveAttribute("type", "button");
    // Touch target 44x44 e controllo dentro il viewport mobile.
    const box = await show.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);

    await show.click();

    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue(PASSWORD);
    const hide = await expectToggle(page, "Nascondi password", true);
    // Il focus resta sul toggle, il nome vecchio non esiste più.
    await expect(hide).toBeFocused();
    await expect(show).toHaveCount(0);

    await hide.click();

    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue(PASSWORD);
    await expectToggle(page, "Mostra password", false);
    await expect(hide).toHaveCount(0);

    // Click sul toggle ≠ submit: il drawer è ancora aperto e senza errore.
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("funziona anche in modalità registrazione", async ({ page }) => {
    await openLoginModal(page);

    const dialog = page.getByRole("dialog");
    // Prima dello switch l'unico bottone "Registrati" è il link di modo
    // (il submit è "Accedi").
    await dialog.getByRole("button", { name: "Registrati", exact: true }).click();
    // A registro attivo il submit è "Registrati" e lo switch è "Accedi".
    await expect(
      dialog.getByRole("button", { name: "Accedi", exact: true })
    ).toBeVisible();

    const password = passwordField(page);
    await password.fill(PASSWORD);
    await expect(password).toHaveAttribute("type", "password");

    await dialog.getByRole("button", { name: "Mostra password" }).click();

    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue(PASSWORD);
    await expect(
      dialog.getByRole("button", { name: "Nascondi password" })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
