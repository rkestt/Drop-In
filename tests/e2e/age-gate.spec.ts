import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

// Gate età #97: i layout (app)/(dashboard) rimandano a /verifica-eta la
// sessione senza riga `profile_age`. Vuole Supabase locale + dev server
// (alzato da Playwright via webServer).
test.describe("age gate", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/age-gate.spec.ts --project=e2e",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

  // Senza riga (il gate deve scattare) e con riga (helper default: il gate
  // non deve scattare mai). `blocked409` è proprietario di una lobby futura
  // condivisa: la delete risponde 409. Autodistruzione in afterAll.
  let young: TestUser;
  let toDelete: TestUser;
  let verified: TestUser;
  let blocked409: TestUser;
  let lobby409Id = "";

  function serviceClient() {
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** "YYYY-MM-DD" di n anni fa (sotto i 14 qualunque sia il fuso). */
  function yearsAgo(n: number): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return d.toISOString().slice(0, 10);
  }

  async function ageRow(userId: string) {
    const { data, error } = await serviceClient()
      .from("profile_age")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as { user_id: string } | null;
  }

  test.beforeAll(async () => {
    try {
      young = await createConfirmedUser("-age-young", { birthDate: null });
      toDelete = await createConfirmedUser("-age-del", { birthDate: null });
      verified = await createConfirmedUser("-age-ok");
      blocked409 = await createConfirmedUser("-age-409", { birthDate: null });

      // Lobby futura open di blocked409 con verified iscritto: il pre-check
      // della delete scatta con 409 (stesso schema di account-deletion).
      const admin = serviceClient();
      const { data: court, error: courtError } = await createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      )
        .from("courts")
        .select("id")
        .limit(1)
        .single();
      if (courtError || !court) throw courtError ?? new Error("seed assente");
      const { data: lobby, error: lobbyError } = await admin
        .from("lobbies")
        .insert({
          court_id: (court as { id: string }).id,
          creator_id: blocked409.id,
          start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          max_players: 10,
          status: "open",
        })
        .select("id")
        .single();
      if (lobbyError || !lobby)
        throw lobbyError ?? new Error("lobby 409 non creata");
      lobby409Id = (lobby as { id: string }).id;
      const { error: joinError } = await admin
        .from("lobby_participants")
        .insert({ lobby_id: lobby409Id, user_id: verified.id });
      if (joinError) throw joinError;
    } catch (e) {
      const admin = serviceClient();
      if (lobby409Id) {
        await admin.from("lobby_participants").delete().eq("lobby_id", lobby409Id);
        await admin.from("lobbies").delete().eq("id", lobby409Id);
        lobby409Id = "";
      }
      for (const u of [young!, toDelete!, verified!, blocked409!]) {
        try {
          if (u) await admin.auth.admin.deleteUser(u.id);
        } catch {
          // best-effort: lo spec ha già detto la sua
        }
      }
      throw e;
    }
  });

  test.afterAll(async () => {
    const admin = serviceClient();
    try {
      if (lobby409Id) {
        await admin.from("lobby_participants").delete().eq("lobby_id", lobby409Id);
        await admin.from("lobbies").delete().eq("id", lobby409Id);
      }
    } finally {
      for (const u of [young, toDelete, verified, blocked409]) {
        try {
          if (u) await admin.auth.admin.deleteUser(u.id);
        } catch {
          // best-effort (l'utente del test 4 è già cancellato dalla route)
        }
      }
    }
  });

  test("senza riga → / rimanda a /verifica-eta", async ({ page }) => {
    await loginViaUI(page, young);
    await page.goto("/");
    await expect(page).toHaveURL(/\/verifica-eta/);
    await expect(
      page.getByRole("heading", { name: "La tua data di nascita" }),
    ).toBeVisible();
  });

  test("dichiara 10 anni → bloccato, nessuna riga scritta", async ({
    page,
  }) => {
    await loginViaUI(page, young);
    await page.goto("/verifica-eta");
    await page.getByRole("textbox", { name: "Data di nascita" }).fill(yearsAgo(10));
    await page.getByRole("button", { name: "Continua" }).click();

    // Blocco, non form: il messaggio parla di 14 anni, mai generico.
    await expect(
      page.getByRole("heading", { name: /almeno 14 anni/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/verifica-eta/);
    await expect(page.getByText(/14 anni/).first()).toBeVisible();

    // Niente INSERT: il filtro client blocca prima del DB.
    expect(await ageRow(young.id)).toBeNull();
  });

  test("corregge con una data ≥14 → entra in / e la riga esiste", async ({
    page,
  }) => {
    await loginViaUI(page, young);
    await page.goto("/verifica-eta");
    // Prima il blocco (ogni test ha un contesto fresco: lo stato `blocked`
    // del test prima non esiste qui), poi la correzione.
    await page.getByRole("textbox", { name: "Data di nascita" }).fill(yearsAgo(10));
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(
      page.getByRole("heading", { name: /almeno 14 anni/ }),
    ).toBeVisible();
    // Riapre il form dal blocco (stato locale, niente server).
    await page.getByRole("button", { name: "Correggi la data" }).click();
    await page.getByRole("textbox", { name: "Data di nascita" }).fill("2000-06-15");
    await page.getByRole("button", { name: "Continua" }).click();

    await expect(page).toHaveURL(/\/$/);
    expect(await ageRow(young.id)).not.toBeNull();
  });

  test("dal blocco: elimina l'account → utente sparito, niente orfani", async ({
    page,
  }) => {
    await loginViaUI(page, toDelete);
    await page.goto("/verifica-eta");
    // L'eliminazione vive nella vista di blocco: prima si dichiara un'età
    // sotto soglia (nessuna riga scritta), poi si cancella l'account.
    await page.getByRole("textbox", { name: "Data di nascita" }).fill(yearsAgo(10));
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(
      page.getByRole("heading", { name: /almeno 14 anni/ }),
    ).toBeVisible();
    // Primo click: apre il drawer; secondo (conferma): cancella davvero.
    await page
      .getByRole("button", { name: "Elimina il mio account" })
      .click();
    await page
      .getByRole("button", { name: "Elimina account", exact: true })
      .click();

    // Torna alla home da anonimo (browse-first: nessun gate, nessun login).
    await expect(page).toHaveURL(/\/$/);

    const admin = serviceClient();
    const { data: gone } = await admin.auth.admin.getUserById(toDelete.id);
    expect(gone?.user ?? null).toBeNull();
    expect(await ageRow(toDelete.id)).toBeNull();
  });

  test("dal gate: 409 con lobby condivise → account intatto, testo coi passi", async ({
    page,
  }) => {
    await loginViaUI(page, blocked409);
    await page.goto("/");
    // Il gate scatta anche per il proprietario della lobby condivisa.
    await expect(page).toHaveURL(/\/verifica-eta/);
    // L'eliminazione vive nella vista di blocco.
    await page.getByRole("textbox", { name: "Data di nascita" }).fill(yearsAgo(10));
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(
      page.getByRole("heading", { name: /almeno 14 anni/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Elimina il mio account" })
      .click();
    await page
      .getByRole("button", { name: "Elimina account", exact: true })
      .click();

    // 409: resta sul gate, drawer aperto col testo dei passi — non quello
    // del server (le lobby non sono raggiungibili da qui).
    await expect(page).toHaveURL(/\/verifica-eta/);
    await expect(
      page.getByText(/partite future con altri iscritti/),
    ).toBeVisible();
    await expect(page.getByText(/cancella quelle lobby/)).toBeVisible();

    // Account intatto: auth vivo, nessuna riga scritta dal blocco.
    const admin = serviceClient();
    const { data: still } = await admin.auth.admin.getUserById(blocked409.id);
    expect(still?.user?.id).toBe(blocked409.id);
    expect(await ageRow(blocked409.id)).toBeNull();
  });

  test("utente con riga → mai mandato al gate", async ({ page }) => {
    await loginViaUI(page, verified);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/verifica-eta/);

    // Anche il gruppo (dashboard) lascia passare.
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/verifica-eta/);
    await expect(
      page.getByRole("heading", { name: "Impostazioni" }),
    ).toBeVisible();
  });
});
