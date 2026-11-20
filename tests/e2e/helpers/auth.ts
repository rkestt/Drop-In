import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Solo locale (stesso default di `npx supabase status`): crea utenti già
// confermati via Admin API così il login via UI funziona senza Mailpit.
function resolveServiceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (/^(https?:\/\/)?(127\.0\.0\.1|localhost)([:/]|$)/.test(SUPABASE_URL)) {
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
  }
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY mancante e URL non locale: niente fallback, per non spedire la chiave di servizio nel posto sbagliato.",
  );
}
export const SERVICE_ROLE_KEY = resolveServiceRoleKey();

export type TestUser = { id: string; email: string; password: string; nickname: string };

/** Crea un utente già confermato via Admin API (locale, richiede Supabase up).
 * Inserisce anche la riga `profile_age` (gate #97: senza, i layout
 * rimandano a /verifica-eta): `birthDate` default "1990-01-01", `null` per
 * non inserirla (la spec del gate parte senza riga). */
export async function createConfirmedUser(
  suffix = "",
  opts?: { birthDate?: string | null },
): Promise<TestUser> {
  const stamp = `${Date.now()}${suffix}`.replace(/[^a-zA-Z0-9]/g, "");
  const email = `a11y-${stamp}@dropin.test`;
  const password = "dropin-a11y-pass";
  const nickname = `a11y_${stamp}`;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname },
  });
  if (error) throw error;
  if (!data.user) throw new Error("createUser senza user");

  // Gate età #97: l'utente entra subito (i layout lasciano passare solo con
  // la riga). Fallisce forte: utente senza riga = rosso ovunque, non un
  // passaggio silenzioso dal gate.
  const birthDate = opts?.birthDate === undefined ? "1990-01-01" : opts.birthDate;
  if (birthDate !== null) {
    const { error: ageError } = await admin
      .from("profile_age")
      .insert({ user_id: data.user.id, birth_date: birthDate });
    if (ageError) {
      try {
        await admin.auth.admin.deleteUser(data.user.id);
      } catch {
        // best-effort: lo spec ha già detto la sua
      }
      throw ageError;
    }
  }
  return { id: data.user.id, email, password, nickname };
}

/**
 * Login via UI: apre `/?login=required`, compila il drawer e attende che si
 * chiuda (sessione nei cookie httpOnly). Da chiamare prima di salvare lo
 * storageState o di visitare route protette.
 */
export async function loginViaUI(
  page: Page,
  user: Pick<TestUser, "email" | "password" | "nickname">,
): Promise<void> {
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
