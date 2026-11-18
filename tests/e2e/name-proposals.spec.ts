import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { trackConsoleErrors } from "./helpers/console";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

// e2e delle proposte di nome (#107): proposta da campo `is_auto_name`,
// approvazione (semplice e con correzione), rifiuto motivato, ritiro in due
// passi e isolamento fra campi (il bloccante della review di #106).
// Due utenti (proponente, moderatore), corti dedicate con nomi unici,
// proposte di moderazione inserite via service role (bypassano il rate
// limit della RPC, come le lobby di series.spec.ts).

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SKIP_MSG =
  "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/name-proposals.spec.ts";

const stamp = Date.now().toString(36);
const courtName = (tag: string) => `Campo Auto E2E ${stamp} ${tag}`;
const proposedName = (tag: string) => `Campetto E2E ${stamp} ${tag}`;
const REJECT_REASON = `Nome inventato per il test E2E ${stamp}`;

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

/** Corte approvata con nome automatico, dedicata al test. */
async function createAutoCourt(userId: string, name: string): Promise<string> {
  const { data, error } = await admin()
    .from("courts")
    .insert({
      name,
      lat: 41.9028,
      lng: 12.4964,
      moderation_status: "approved",
      submitted_by: userId,
      source: "community",
      status: "active",
      is_auto_name: true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert corte fallito");
  return (data as { id: string }).id;
}

/** Proposta pending via service role (niente rate limit della RPC). */
async function insertProposal(
  courtId: string,
  proposerId: string,
  name: string,
): Promise<string> {
  const { data, error } = await admin()
    .from("court_name_proposals")
    .insert({ court_id: courtId, proposer_id: proposerId, proposed_name: name })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert proposta fallito");
  return (data as { id: string }).id;
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

/** Mai codici Postgres/PostgREST in UI (#77). */
async function expectNoDbCodes(page: Page): Promise<void> {
  await expect(page.getByText(/P0001|23514|23505|42501/)).toHaveCount(0);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ricerca dalla home e attesa del contatore pronto (non più "Cerco…"). */
async function searchFromHome(page: Page, query: string): Promise<void> {
  await page.goto("/");
  const box = page.getByRole("searchbox", { name: "Cerca campi per nome" });
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.fill(query);
}

let proponente: TestUser;
let proponenteId = "";
let moderatore: TestUser;
let moderatoreId = "";
// A: proposta via UI · B: approva · C: approva con correzione ·
// D: rifiuta · E: ritira · F/G: cambio campo.
const courtIds: Record<string, string> = {};
const names: Record<string, string> = {};
const proposed: Record<string, string> = {};
const EDITED_C = `Campetto Corretto E2E ${stamp}`;

test.beforeAll(async () => {
  const p = await createUserAndId("-nomeprop");
  proponente = p.user;
  proponenteId = p.userId;
  const m = await createUserAndId("-nomemod");
  moderatore = m.user;
  moderatoreId = m.userId;
  const { error: modError } = await admin()
    .from("profiles")
    .update({ is_moderator: true })
    .eq("user_id", moderatoreId);
  if (modError) throw modError;

  for (const tag of ["A", "B", "C", "D", "E", "F", "G"]) {
    names[tag] = courtName(tag);
    courtIds[tag] = await createAutoCourt(proponenteId, names[tag]);
  }
  // Le proposte di moderazione si inseriscono dentro ogni test, non qui:
  // `propose_court_name` conta le pending dell'ultima ora (tetto 5) e la
  // proposta via UI del primo test deve trovare il contatore a zero.
  for (const tag of ["A", "B", "C", "D", "E", "F"]) {
    proposed[tag] = proposedName(tag);
  }
});

test.afterAll(async () => {
  const a = admin();
  for (const tag of ["A", "B", "C", "D", "E", "F", "G"]) {
    const id = courtIds[tag];
    if (id) await a.from("courts").delete().eq("id", id);
  }
  if (proponente) await deleteUserByEmail(proponente.email);
  if (moderatore) await deleteUserByEmail(moderatore.email);
});

// ---------------------------------------------------------------------------
// Proposta via UI: invito, invio, pending visibile, nome invariato.
// ---------------------------------------------------------------------------
test.describe("proposta da campo automatico", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  test("invito, invio dal form, pending senza cambio nome né risultati", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, proponente);
    await page.goto(`/courts/${courtIds["A"]}`);
    await expect(page.locator("h1")).toHaveText(names["A"], {
      timeout: 15_000,
    });

    // Invito: chip + azione, nessun pending.
    await expect(page.getByText("Nome automatico")).toBeVisible();
    const invite = page.getByRole("button", {
      name: `Proponi il nome vero per ${names["A"]}`,
    });
    await expect(invite).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Proposta in attesa/ }),
    ).toHaveCount(0);

    // Form: riepilogo adesso/proposto, invio, esito.
    await invite.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Proponi il nome" }),
    ).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel("Nome del campo").fill(proposed["A"]);
    await expect(
      dialog.getByText(proposed["A"], { exact: false }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Invia proposta" }).click();
    await expect(dialog.getByText("Proposta inviata.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      dialog.getByText(`«${proposed["A"]}» è in revisione.`),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Chiudi" }).click();

    // Pending immediata (stato locale) e dopo reload (verità del DB);
    // il nome del campo non è cambiato.
    const pendingLink = page.getByRole("link", {
      name: new RegExp(`Proposta in attesa: ${escapeRegExp(proposed["A"])}`),
    });
    await expect(pendingLink).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator("h1")).toHaveText(names["A"], {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("link", {
        name: new RegExp(`Proposta in attesa: ${escapeRegExp(proposed["A"])}`),
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Il nome proposto non esiste in mappa/ricerca prima dell'approvazione:
    // la ricerca torna zero risultati.
    await searchFromHome(page, proposed["A"]);
    await expect(
      page
        .getByText(
          new RegExp(`Nessun campo per «${escapeRegExp(proposed["A"])}»`),
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoDbCodes(page);
    tracker.assertClean();
  });
});

// ---------------------------------------------------------------------------
// Moderazione: approva, approva con correzione, rifiuta.
// ---------------------------------------------------------------------------
test.describe("moderazione nomi", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  async function openNamesQueue(page: Page): Promise<void> {
    await loginViaUI(page, moderatore);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Moderazione" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: /^Nomi/ }).click();
  }

  test("approvazione: nome nuovo, badge sparito, ricerca lo trova", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await insertProposal(courtIds["B"], proponenteId, proposed["B"]);
    await openNamesQueue(page);
    const row = page.locator("#panel-names li", {
      hasText: proposed["B"],
    });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row
      .getByRole("button", { name: "Approva", exact: true })
      .click();
    await expect(
      page.getByText(`Nome approvato: «${proposed["B"]}».`),
    ).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveCount(0, { timeout: 10_000 });

    // Scheda: h1 col nome nuovo, niente chip né invito.
    await page.goto(`/courts/${courtIds["B"]}`);
    await expect(page.locator("h1")).toHaveText(proposed["B"], {
      timeout: 15_000,
    });
    await expect(page.getByText("Nome automatico")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Proponi il nome vero/ }),
    ).toHaveCount(0);

    // Ricerca: il nome approvato si trova.
    await searchFromHome(page, proposed["B"]);
    await expect(
      page
        .getByText(new RegExp(`1 campo per «${escapeRegExp(proposed["B"])}»`))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoDbCodes(page);
    tracker.assertClean();
  });

  test("approvazione con correzione: vince il nome del moderatore", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await insertProposal(courtIds["C"], proponenteId, proposed["C"]);
    await openNamesQueue(page);
    const row = page.locator("#panel-names li", {
      hasText: proposed["C"],
    });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "Modifica" }).click();
    await row.getByLabel("Nome che approvi").fill(EDITED_C);
    await row
      .getByRole("button", { name: "Approva con questo nome" })
      .click();
    await expect(
      page.getByText(`Nome approvato: «${EDITED_C}».`),
    ).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveCount(0, { timeout: 10_000 });

    await page.goto(`/courts/${courtIds["C"]}`);
    await expect(page.locator("h1")).toHaveText(EDITED_C, {
      timeout: 15_000,
    });
    await searchFromHome(page, EDITED_C);
    await expect(
      page
        .getByText(new RegExp(`1 campo per «${escapeRegExp(EDITED_C)}»`))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoDbCodes(page);
    tracker.assertClean();
  });

  test("rifiuto con motivo: il motivo compare in Nomi che hai proposto", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await insertProposal(courtIds["D"], proponenteId, proposed["D"]);
    await openNamesQueue(page);
    const row = page.locator("#panel-names li", {
      hasText: proposed["D"],
    });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "Rifiuta" }).click();
    await row.getByLabel("Motivo del rifiuto").fill(REJECT_REASON);
    await row.getByRole("button", { name: "Conferma rifiuto" }).click();
    await expect(
      page.getByText(`Nome rifiutato. Motivo: ${REJECT_REASON}`),
    ).toBeVisible({ timeout: 10_000 });

    // Lato proponente: la riga resta, con badge e motivo.
    await loginViaUI(page, proponente);
    await page.goto("/submit-court#nomi");
    await expect(
      page.getByRole("heading", { name: "Nomi che hai proposto" }),
    ).toBeVisible({ timeout: 15_000 });
    const mine = page.locator("#nomi li", { hasText: proposed["D"] });
    await expect(mine).toBeVisible({ timeout: 10_000 });
    await expect(mine.getByText("Rifiutata", { exact: true })).toBeVisible();
    await expect(
      mine.getByText(`Motivo: ${REJECT_REASON}`, { exact: false }),
    ).toBeVisible();

    await expectNoDbCodes(page);
    // La review di #106 cadeva su chiavi React duplicate: nessun warning.
    const keyErrors = tracker.errors.filter((t) =>
      /two children|same key/i.test(t),
    );
    expect(keyErrors).toEqual([]);
    tracker.assertClean();
  });
});

// ---------------------------------------------------------------------------
// Ritiro in due passi + isolamento fra campi.
// ---------------------------------------------------------------------------
test.describe("ritiro e cambio campo", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  test("ritiro in due passi: stato Ritirata, riga conservata", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await insertProposal(courtIds["E"], proponenteId, proposed["E"]);
    await loginViaUI(page, proponente);
    await page.goto("/submit-court#nomi");
    await expect(
      page.getByRole("heading", { name: "Nomi che hai proposto" }),
    ).toBeVisible({ timeout: 15_000 });
    const row = page.locator("#nomi li", { hasText: proposed["E"] });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("In revisione")).toBeVisible();

    await row.getByRole("button", { name: "Ritira" }).click();
    await expect(row.getByText("Ritirare la proposta?")).toBeVisible({
      timeout: 10_000,
    });
    await row.getByRole("button", { name: "Conferma ritiro" }).click();
    await expect(row.getByText("Ritirata", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      row.getByText(/Ritirata da te ·/, { exact: false }),
    ).toBeVisible();
    // Riga conservata, non cancellata.
    await expect(
      page.locator("#nomi li", { hasText: proposed["E"] }),
    ).toHaveCount(1);
    await expectNoDbCodes(page);
    tracker.assertClean();
  });

  test("cambio campo: il secondo mostra l'invito, non la pending del primo", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await insertProposal(courtIds["F"], proponenteId, proposed["F"]);
    await loginViaUI(page, proponente);
    // Il primo campo ha la pending dell'utente.
    await page.goto(`/courts/${courtIds["F"]}`);
    await expect(
      page.getByRole("link", {
        name: new RegExp(`Proposta in attesa: ${escapeRegExp(proposed["F"])}`),
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Il secondo (senza proposte) mostra l'invito: il `key` per campo
    // impedisce allo stato locale del primo di sopravvivere alla navigazione.
    await page.goto(`/courts/${courtIds["G"]}`);
    await expect(page.locator("h1")).toHaveText(names["G"], {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", {
        name: `Proponi il nome vero per ${names["G"]}`,
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("link", { name: /Proposta in attesa/ }),
    ).toHaveCount(0);

    tracker.assertClean();
  });
});
