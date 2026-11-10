import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Solo locale (stesso default di `npx supabase status`): crea utenti già
// confermati via Admin API così il login via UI funziona senza Mailpit.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export type TestUser = { email: string; password: string; nickname: string };

/** Crea un utente già confermato via Admin API (locale, richiede Supabase up). */
export async function createConfirmedUser(suffix = ""): Promise<TestUser> {
  const stamp = `${Date.now()}${suffix}`.replace(/[^a-zA-Z0-9]/g, "");
  const email = `a11y-${stamp}@dropin.test`;
  const password = "dropin-a11y-pass";
  const nickname = `a11y_${stamp}`;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname },
  });
  if (error) throw error;
  return { email, password, nickname };
}

/**
 * Login via UI: apre `/?login=required`, compila il drawer e attende che si
 * chiuda (sessione nei cookie httpOnly). Da chiamare prima di salvare lo
 * storageState o di visitare route protette.
 */
export async function loginViaUI(page: Page, user: TestUser): Promise<void> {
  // Flag pre-navigazione: senza, il drawer di primo avvio si apre sopra il
  // login e Base UI marca il login `inert` (bottoni introvabili).
  await page.addInitScript(() => {
    localStorage.setItem("dropin:onboarded:v1", "1");
    localStorage.setItem("dropin:coach:check-in", "1");
  });
  await page.goto("/?login=required");
  await page.getByLabel("Indirizzo email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  // Il drawer si chiude a login avvenuto; se resta aperto, mostra l'errore.
  await page.getByLabel("Indirizzo email").waitFor({ state: "detached", timeout: 15_000 });
}
