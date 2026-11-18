import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { trackConsoleErrors } from "./helpers/console";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

// e2e delle note di campo (#108): scrittura moderatore con comparsa in cima
// ("adesso", senza reload), bottone assente per gli altri + RPC 42501,
// vecchie sotto "Precedenti" con riga di testa, fold oltre 3 note, anteprima
// in mappa al primo frame. I difetti chiusi in review (pop-in da 31px,
// chiavi React duplicate) sono coperti dal tracker console + check mirati.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SKIP_MSG =
  "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/court-notes.spec.ts";

const stamp = Date.now().toString(36);
const OLD_DAYS = 40;
const oldIso = () =>
  new Date(Date.now() - OLD_DAYS * 86_400_000).toISOString();
const NOTE_BODY = `Retina senza rete E2E ${stamp}`;
const FRESH_BODY = `Cancello aperto E2E ${stamp}`;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Utente confermato + id (per le fixture via service role). */
async function createUserAndId(
  suffix: string,
): Promise<{ user: TestUser; userId: string }> {
  const user = await createConfirmedUser(suffix);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.user) throw error ?? new Error("login REST fallito");
  return { user, userId: data.user.id };
}

/** Corte approvata dedicata al test. */
async function createCourt(
  userId: string,
  name: string,
  lat = 41.9028,
  lng = 12.4964,
): Promise<string> {
  const { data, error } = await admin()
    .from("courts")
    .insert({
      name,
      lat,
      lng,
      moderation_status: "approved",
      submitted_by: userId,
      source: "community",
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert corte fallito");
  return (data as { id: string }).id;
}

async function insertNote(
  courtId: string,
  authorId: string,
  kind: string,
  body: string | null,
  createdAt?: string,
): Promise<void> {
  const { error } = await admin().from("court_notes").insert({
    court_id: courtId,
    author_id: authorId,
    kind,
    body,
    ...(createdAt ? { created_at: createdAt } : {}),
  });
  if (error) throw error;
}

async function deleteUserByEmail(email: string): Promise<void> {
  try {
    const a = admin();
    const { data } = await a.auth.admin.listUsers({ perPage: 200 });
    const prev = data?.users.find((u) => u.email === email);
    if (prev) await a.auth.admin.deleteUser(prev.id);
  } catch {
    // Best-effort.
  }
}

let utente: TestUser;
let moderatore: TestUser;
let moderatoreId = "";
const courtIds: Record<string, string> = {};
const courtNames: Record<string, string> = {
  write: `Campo Nota Write E2E ${stamp}`,
  plain: `Campo Nota Plain E2E ${stamp}`,
  old: `Campo Nota Old E2E ${stamp}`,
  mixed: `Campo Nota Mixed E2E ${stamp}`,
  fold: `Campo Nota Fold E2E ${stamp}`,
  // "AAA" in testa: la lista campi è alfabetica con tetto a 30.
  mapFresh: `AAA Nota Mappa E2E ${stamp} F`,
  mapBare: `AAA Nota Mappa E2E ${stamp} B`,
};

test.beforeAll(async () => {
  const u = await createUserAndId("-notebase");
  utente = u.user;
  const m = await createUserAndId("-notemod");
  moderatore = m.user;
  moderatoreId = m.userId;
  const { error: modError } = await admin()
    .from("profiles")
    .update({ is_moderator: true })
    .eq("user_id", moderatoreId);
  if (modError) throw modError;

  for (const [key, name] of Object.entries(courtNames)) {
    // L'anteprima mappa si apre dalla lista dei campi visibili nel bbox di
    // default (zoom 14 sul centro): quei due campi stanno al centro, gli
    // altri alle coordinate standard delle fixture (bastano a scheda e
    // ricerca, che usa un raggio di 25 km).
    const atCenter = key === "mapFresh" || key === "mapBare";
    courtIds[key] = atCenter
      ? await createCourt(moderatoreId, name, 41.8919, 12.5113)
      : await createCourt(moderatoreId, name);
  }

  // old: solo una nota da 40 giorni. mixed: una fresca + una da 40 giorni.
  await insertNote(
    courtIds["old"],
    moderatoreId,
    "closed",
    `Chiuso per lavori E2E ${stamp}`,
    oldIso(),
  );
  await insertNote(
    courtIds["mixed"],
    moderatoreId,
    "closed",
    `Chiuso per lavori E2E ${stamp}`,
    oldIso(),
  );
  await insertNote(
    courtIds["mixed"],
    moderatoreId,
    "broken_hoop",
    FRESH_BODY,
  );
  // fold: cinque fresche, corpi distinguibili.
  for (let i = 1; i <= 5; i += 1) {
    await insertNote(
      courtIds["fold"],
      moderatoreId,
      "broken_hoop",
      `Nota fold E2E ${stamp} ${i}`,
    );
  }
  // mappa: una fresca su F, niente su B.
  await insertNote(courtIds["mapFresh"], moderatoreId, "broken_hoop", null);
});

test.afterAll(async () => {
  const a = admin();
  for (const id of Object.values(courtIds)) {
    if (id) await a.from("courts").delete().eq("id", id);
  }
  if (utente) await deleteUserByEmail(utente.email);
  if (moderatore) await deleteUserByEmail(moderatore.email);
});

// ---------------------------------------------------------------------------
// Scrittura moderatore: in cima con "adesso", senza reload.
// ---------------------------------------------------------------------------
test.describe("nota del moderatore", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  test("aggiunta dal drawer: in cima con adesso, senza reload", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, moderatore);
    await page.goto(`/courts/${courtIds["write"]}`);
    await expect(
      page.getByRole("heading", { name: "Note di campo" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Nessuna nota di campo.")).toBeVisible();

    await page.getByRole("button", { name: "+ Aggiungi nota" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Aggiungi una nota" }),
    ).toBeVisible({ timeout: 10_000 });
    // Il radio è sr-only dentro la label-chip: si attiva via label.
    await dialog.getByText("Canestro rotto", { exact: true }).click();
    await expect(
      dialog.getByRole("radio", { name: "Canestro rotto" }),
    ).toBeChecked({ timeout: 10_000 });
    await dialog.getByLabel("Testo").fill(NOTE_BODY);
    await dialog.getByRole("button", { name: "Aggiungi nota" }).click();
    await expect(dialog.getByText("Nota aggiunta.")).toBeVisible({
      timeout: 10_000,
    });
    await dialog.getByRole("button", { name: "Chiudi" }).click();

    // Nessun reload chiamato: la riga nuova è in cima con "adesso".
    const card = page.locator("section", {
      has: page.getByRole("heading", { name: "Note di campo" }),
    });
    await expect(card.getByText(NOTE_BODY)).toBeVisible({ timeout: 10_000 });
    await expect(card.locator("ul li").first()).toContainText(NOTE_BODY);
    await expect(card.locator("ul li").first()).toContainText("adesso");

    tracker.assertClean();
  });

  test("utente normale: bottone assente e scrittura respinta 42501", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, utente);
    await page.goto(`/courts/${courtIds["plain"]}`);
    await expect(
      page.getByRole("heading", { name: "Note di campo" }),
    ).toBeVisible({ timeout: 15_000 });
    // Il bottone non esiste nel DOM: niente disabilitato, niente lucchetto.
    await expect(
      page.getByRole("button", { name: "+ Aggiungi nota" }),
    ).toHaveCount(0);

    // RPC diretta col ruolo dell'utente: 42501, stesso codice del prodotto.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: utente.email,
      password: utente.password,
    });
    if (signInError) throw signInError;
    const { error } = await anon.rpc("add_court_note", {
      p_court_id: courtIds["plain"],
      p_kind: "broken_hoop",
      p_body: "tentativo non moderatore",
    });
    expect(error?.code).toBe("42501");

    tracker.assertClean();
  });
});

// ---------------------------------------------------------------------------
// Vecchie, fold, anteprima mappa.
// ---------------------------------------------------------------------------
test.describe("lettura: vecchie, fold, anteprima", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  test("40 giorni: sotto Precedenti con una fresca, headline da sola", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);

    // Mista: la vecchia sta sotto il separatore, niente riga di testa
    // (la più recente è fresca e l'età è già sulla prima riga).
    await page.goto(`/courts/${courtIds["mixed"]}`);
    await expect(
      page.getByRole("heading", { name: "Note di campo" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Precedenti")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("5 settimane fa")).toBeVisible();
    await expect(page.getByText(/Nessuna nota recente/)).toHaveCount(0);
    const mixedItems = page.locator(
      "section:has(h2:text-is('Note di campo')) ul li",
    );
    await expect(mixedItems.first()).toContainText(FRESH_BODY);

    // Solo vecchie: riga di testa con l'età dell'ultima.
    await page.goto(`/courts/${courtIds["old"]}`);
    await expect(
      page.getByText("Nessuna nota recente: l'ultima è di 5 settimane fa."),
    ).toBeVisible({ timeout: 15_000 });

    // Il difetto del gate su #90: chiavi React duplicate in console.
    const keyErrors = tracker.errors.filter((t) =>
      /two children|same key/i.test(t),
    );
    expect(keyErrors).toEqual([]);
    tracker.assertClean();
  });

  test("più di 3 note: fold con conteggio e aria-expanded", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto(`/courts/${courtIds["fold"]}`);
    await expect(
      page.getByRole("heading", { name: "Note di campo" }),
    ).toBeVisible({ timeout: 15_000 });

    const card = page.locator("section", {
      has: page.getByRole("heading", { name: "Note di campo" }),
    });
    const rows = card.locator("ul li");
    await expect(rows).toHaveCount(3, { timeout: 10_000 });
    const fold = card.getByRole("button", {
      name: "Mostra le altre 2 note",
    });
    await expect(fold).toBeVisible();
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await fold.click();
    const less = card.getByRole("button", { name: "Mostra meno" });
    await expect(less).toBeVisible({ timeout: 10_000 });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    await expect(rows).toHaveCount(5, { timeout: 10_000 });

    tracker.assertClean();
  });

  test("anteprima mappa: riga al primo frame con nota, assente senza", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/");
    await page.waitForFunction(() => !!window.__dropinMap, undefined, {
      timeout: 30_000,
    });
    // La lista segue i marker e, con ricerca attiva, i risultati server:
    // si cerca il prefisso unico delle due fixture così la lista contiene
    // solo i nostri due campi (il browse a bbox larga taglia a 1000 righe
    // non ordinate e le fixture resterebbero fuori).
    const box = page.getByRole("searchbox", { name: "Cerca campi per nome" });
    await expect(box).toBeVisible({ timeout: 15_000 });
    await box.fill(`AAA Nota Mappa E2E ${stamp}`);
    await expect(
      page
        .getByText(/2 campi per «AAA Nota Mappa/, { exact: false })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    const listButton = page.getByRole("button", { name: /Lista campi/i });
    await expect(listButton).toBeVisible({ timeout: 20_000 });

    // Campo con nota fresca: il foglio apre solo a fetch risolta, quindi
    // la riga c'è già quando il dialog esiste (niente pop-in da 31px).
    await listButton.click();
    const list = page.getByRole("dialog", { name: /Lista campi/i });
    await expect(list).toBeVisible({ timeout: 10_000 });
    await list
      .getByRole("button", { name: new RegExp(courtNames["mapFresh"]) })
      .click();
    const sheet = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("link", { name: "Apri dettaglio" }) });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    // Lettura immediata, senza retry: è il primo frame del foglio.
    expect(await sheet.getByText("Canestro rotto").count()).toBeGreaterThan(
      0,
    );
    await sheet.getByRole("button", { name: "Chiudi" }).click();

    // Campo senza note: nessuna riga, al primo frame come dopo.
    await listButton.click();
    await expect(list).toBeVisible({ timeout: 10_000 });
    await list
      .getByRole("button", { name: new RegExp(courtNames["mapBare"]) })
      .click();
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    expect(await sheet.getByText("Canestro rotto").count()).toBe(0);

    tracker.assertClean();
  });
});
