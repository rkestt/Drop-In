import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";

/**
 * d8 — validazione submit-court (RHF + zod, onSubmit/onChange):
 * submit vuoto -> errore inline + focus sul nome; correzione -> errore via.
 * (Il successo completo richiede auth + GPS: coperto dal test manuale.)
 */
test("submit-court vuoto mostra errore inline con focus, poi si corregge", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);
  await page.goto("/submit-court");

  const nameInput = page.getByLabel("Nome del campo", { exact: true });
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  // Submit a vuoto: errore inline sullo schema (nome o foto) + focus sul nome.
  await page.getByRole("button", { name: "Invia campo" }).click();
  const nameError = page.getByRole("alert").filter({
    hasText: "Inserisci un nome o carica una foto",
  });
  await expect(nameError).toBeVisible();
  await expect(nameInput).toBeFocused();
  await expect(nameInput).toHaveAttribute("aria-invalid", "true");

  // Correzione: digitando, la rivalidazione live fa sparire l'errore.
  await nameInput.fill("Campetto Via Napoli");
  await expect(nameError).toBeHidden();

  tracker.assertClean();
});
