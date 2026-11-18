import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { trackConsoleErrors } from "./helpers/console";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

// e2e delle serie ricorrenti (#103): i flussi che la lane live di #92 ha
// verificato a mano (creazione con switch, partita singola + doppioni, tab
// Serie, capienza, orfane). Vuole Supabase locale + utenti di test, come gli
// altri blocchi autenticati.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SKIP_MSG =
  "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/series.spec.ts";

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

/** Corte approvata dedicata al test (niente interferenze fra file). */
async function createCourt(userId: string, name: string): Promise<string> {
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
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert corte fallito");
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

/** Etichette ISO 1–7 della spec (`seriesWeekdayLabel`, tabella statica). */
const IT_WEEKDAYS = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

/** Giorno ISO + `HH:MM` di un istante nel fuso del prodotto (mai device). */
function romeParts(iso: string): { weekday: number; time: string } {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = key.split("-").map(Number);
  const weekday = ((new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, day ?? 1)).getUTCDay() + 6) % 7) + 1;
  return { weekday, time };
}

/** Istante futuro arrotondato all'ora (per le fixture via API). */
function plusDaysRounded(days: number): string {
  const t = new Date(Date.now() + days * 86_400_000);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(0);
  return t.toISOString();
}

/** Mai codici Postgres/PostgREST in UI (#77, capienza #92). */
async function expectNoDbCodes(page: Page): Promise<void> {
  await expect(page.getByText(/P0001|23514|23505|42501/)).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// 1–2. Drawer di creazione: switch acceso (serie + occorrenza immediata) e
// spento (partita singola + avviso doppioni).
// ---------------------------------------------------------------------------
test.describe("serie via drawer di creazione", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  let userA: TestUser;
  let courtAId = "";
  const stamp = Date.now();
  const courtAName = `Campo Serie E2E ${stamp}`;

  test.beforeAll(async () => {
    const created = await createUserAndId("-seriea");
    userA = created.user;
    courtAId = await createCourt(created.userId, courtAName);
  });

  test.afterAll(async () => {
    const a = admin();
    const { data: series } = await a
      .from("lobby_series")
      .select("id")
      .eq("court_id", courtAId);
    const seriesIds = ((series ?? []) as { id: string }[]).map((s) => s.id);
    const { data: lobbies } = await a
      .from("lobbies")
      .select("id")
      .eq("court_id", courtAId);
    const lobbyIds = ((lobbies ?? []) as { id: string }[]).map((l) => l.id);
    if (lobbyIds.length > 0) {
      await a.from("lobby_participants").delete().in("lobby_id", lobbyIds);
      await a.from("lobbies").delete().in("id", lobbyIds);
    }
    if (seriesIds.length > 0) {
      await a.from("lobby_series").delete().in("id", seriesIds);
    }
    if (courtAId) await a.from("courts").delete().eq("id", courtAId);
    if (userA) await deleteUserByEmail(userA.email);
  });

  test("switch acceso: la serie esiste e un'occorrenza compare subito", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, userA);
    await page.goto(`/courts/${courtAId}`);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "Crea lobby" }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Domani/ }).click();
    await dialog.getByRole("button", { name: "Ore 20:00" }).click();

    const repeatSwitch = dialog.getByRole("switch", {
      name: /Ripeti ogni settimana/,
    });
    await expect(repeatSwitch).toHaveAttribute("aria-checked", "false");
    await repeatSwitch.click();
    await expect(repeatSwitch).toHaveAttribute("aria-checked", "true");

    // La regola è quella dell'orario scelto (spec superficie 1).
    const summary = dialog.getByText(/^Ogni .* alle 20:00, al /);
    await expect(summary).toBeVisible();
    const summaryText = (await summary.textContent()) ?? "";
    const ruleMatch = /Ogni (.+) alle (\d{2}:\d{2})/.exec(summaryText);
    if (!ruleMatch) throw new Error(`riepilogo non parsabile: ${summaryText}`);

    await dialog.getByRole("button", { name: "Crea lobby" }).click();
    await expect(page.getByText(/Serie attiva il/)).toBeVisible({
      timeout: 15_000,
    });

    // Materializzazione, non cron: le righe esistono subito.
    const a = admin();
    const { data: seriesRow, error: seriesError } = await a
      .from("lobby_series")
      .select("id, weekday, time_of_day")
      .eq("court_id", courtAId)
      .single();
    if (seriesError || !seriesRow) {
      throw seriesError ?? new Error("serie non creata");
    }
    const series = seriesRow as {
      id: string;
      weekday: number;
      time_of_day: string;
    };
    const { data: occs, error: occsError } = await a
      .from("lobbies")
      .select("id, start_time")
      .eq("series_id", series.id)
      .order("start_time", { ascending: true });
    if (occsError) throw occsError;
    const occurrences = (occs ?? []) as { id: string; start_time: string }[];
    expect(occurrences.length).toBeGreaterThan(0);

    // start_time è quello atteso per il giorno/ora scelto, nel fuso Roma.
    const first = romeParts(occurrences[0].start_time);
    expect(first.time).toBe(series.time_of_day.slice(0, 5));
    expect(first.weekday).toBe(series.weekday);
    expect(summaryText).toContain(
      `Ogni ${IT_WEEKDAYS[first.weekday - 1]} alle ${first.time}`,
    );

    // Il tab Serie mostra regola, prossima e 0 confermati (appena generata).
    await page.goto("/lobbies?tab=serie");
    await expect(
      page.getByText(`Ogni ${IT_WEEKDAYS[first.weekday - 1]} alle ${first.time}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Prossima:/)).toBeVisible();
    await expect(page.getByText(/0\/10 confermati/)).toBeVisible();

    tracker.assertClean();
  });

  test("switch spento: partita singola e avviso doppioni al secondo tentativo", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, userA);
    await page.goto(`/courts/${courtAId}`);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

    const dialog = page.getByRole("dialog");
    const dayButtons = () =>
      dialog.getByRole("group", { name: "Giorno" }).getByRole("button");
    // Dopodomani 10:00: mai in sovrapposizione con l'occorrenza del test
    // prima (weekday diverso, niente skermo del generatore di mezzo).
    async function openAndPick(): Promise<void> {
      await page.getByRole("button", { name: "Crea lobby" }).first().click();
      await expect(dialog).toBeVisible();
      await dayButtons().nth(2).click();
      await dialog.getByRole("button", { name: "Ore 10:00" }).click();
      await expect(
        dialog.getByRole("switch", { name: /Ripeti ogni settimana/ }),
      ).toHaveAttribute("aria-checked", "false");
    }

    await openAndPick();
    await dialog.getByRole("button", { name: "Crea lobby" }).click();
    await expect(page.getByText("Lobby creata")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Secondo tentativo identico: avviso, non insert silenzioso.
    await openAndPick();
    await dialog.getByRole("button", { name: "Crea lobby" }).click();
    await expect(
      dialog.getByText("C'è già una lobby su questo campo"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole("button", { name: "Unisciti" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Crea comunque" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    tracker.assertClean();
  });
});

// ---------------------------------------------------------------------------
// 3. Tab Serie: vuoto, una serie, pausa, cancellazione inline.
// ---------------------------------------------------------------------------
test.describe("tab Serie: stati, pausa, cancellazione", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  let userB: TestUser;
  let userBId = "";
  let courtBId = "";
  const stamp = Date.now();
  const courtBName = `Campo Tab Serie E2E ${stamp}`;
  let seriesBId = "";
  let lobbyBId = "";

  test.beforeAll(async () => {
    const created = await createUserAndId("-serieb");
    userB = created.user;
    userBId = created.userId;
    courtBId = await createCourt(userBId, courtBName);
  });

  test.afterAll(async () => {
    const a = admin();
    if (lobbyBId) {
      await a.from("lobby_participants").delete().eq("lobby_id", lobbyBId);
      await a.from("lobbies").delete().eq("id", lobbyBId);
    }
    if (seriesBId) {
      await a.from("lobby_series").delete().eq("id", seriesBId);
    }
    if (courtBId) await a.from("courts").delete().eq("id", courtBId);
    if (userB) await deleteUserByEmail(userB.email);
  });

  test("0 serie: stato vuoto con invito a creare", async ({ page }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, userB);
    await page.goto("/lobbies?tab=serie");
    await expect(page.getByText("Nessuna serie")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/diventa il tuo appuntamento fisso al campo/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Trova un campo" }),
    ).toBeVisible();
    await expect(page.locator("#panel-serie").getByText("In pausa")).toHaveCount(0);
    tracker.assertClean();
  });

  test("1 serie: regola, prossima, pausa, cancellazione con focus", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    // Fixture via API: la regola e un'occorrenza aperta con 0 conferme.
    const startIso = plusDaysRounded(3);
    const rp = romeParts(startIso);
    const dayLabel = IT_WEEKDAYS[rp.weekday - 1];
    const a = admin();
    const { data: srow, error: serror } = await a
      .from("lobby_series")
      .insert({
        court_id: courtBId,
        creator_id: userBId,
        weekday: rp.weekday,
        time_of_day: rp.time,
      })
      .select("id")
      .single();
    if (serror || !srow) throw serror ?? new Error("serie non creata");
    seriesBId = (srow as { id: string }).id;
    const { data: lrow, error: lerror } = await a
      .from("lobbies")
      .insert({
        court_id: courtBId,
        creator_id: userBId,
        start_time: startIso,
        max_players: 10,
        status: "open",
        series_id: seriesBId,
      })
      .select("id")
      .single();
    if (lerror || !lrow) throw lerror ?? new Error("occorrenza non creata");
    lobbyBId = (lrow as { id: string }).id;

    await loginViaUI(page, userB);
    await page.goto("/lobbies?tab=serie");
    const panel = page.locator("#panel-serie");
    await expect(
      panel.getByText(`Ogni ${dayLabel} alle ${rp.time}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/Prossima:/)).toBeVisible();
    await expect(panel.getByText(/0\/10 confermati/)).toBeVisible();

    // Pausa: badge + nota, le occorrenze restano.
    const toggle = panel.getByRole("switch", { name: new RegExp(courtBName) });
    await toggle.click();
    await expect(panel.getByText("In pausa")).toBeVisible({ timeout: 10_000 });
    await expect(
      panel.getByText("Nessuna nuova partita finché non la riattivi."),
    ).toBeVisible();

    // Cancellazione: conferma inline col focus sul contenitore (il bottone
    // che l'ha aperta sparisce, come l'avviso doppioni del drawer).
    const delTrigger = panel.getByRole("button", { name: /Cancella la serie/ });
    await delTrigger.click();
    const confirmGroup = panel.getByRole("group", {
      name: /Conferma cancellazione della serie/,
    });
    await expect(confirmGroup).toBeVisible({ timeout: 10_000 });
    await expect(confirmGroup).toBeFocused();
    await expect(
      panel.getByText(/Cancelliamo la serie: non creeremo altre partite/),
    ).toBeVisible();

    // Annulla: la riga torna col suo trigger, e il focus torna al
    // trigger (il bottone era smontato durante la conferma).
    await panel.getByRole("button", { name: "Lascia attiva" }).click();
    await expect(delTrigger).toBeVisible({ timeout: 10_000 });
    await expect(delTrigger).toBeFocused();

    // Conferma: la riga sparisce, le occorrenze diventano singole.
    await delTrigger.click();
    await expect(confirmGroup).toBeVisible({ timeout: 10_000 });
    await panel.getByRole("button", { name: "Sì, cancella la serie" }).click();
    await expect(panel.getByText(courtBName)).toHaveCount(0, { timeout: 10_000 });
    // Il testo vive anche nella live region sr-only: si cerca nel toast.
    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Serie cancellata. Le partite in programma restano.",
      }),
    ).toBeVisible({ timeout: 10_000 });

    const { data: gone } = await a
      .from("lobby_series")
      .select("id")
      .eq("id", seriesBId);
    expect(gone ?? []).toEqual([]);
    const { data: orphaned } = await a
      .from("lobbies")
      .select("series_id")
      .eq("id", lobbyBId)
      .single();
    expect((orphaned as { series_id: string | null }).series_id).toBeNull();
    seriesBId = "";

    tracker.assertClean();
  });
});

// ---------------------------------------------------------------------------
// 4. Capienza: join oltre il pieno rifiutato dal DB, messaggio italiano.
// ---------------------------------------------------------------------------
test.describe("capienza: messaggio comprensibile sul pieno", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  let owner: TestUser;
  let filler1Id = "";
  let filler2Id = "";
  let joiner: TestUser;
  let courtCId = "";
  let lobbyCId = "";
  const stamp = Date.now();
  const courtCName = `Campo Pieno E2E ${stamp}`;

  test.beforeAll(async () => {
    const createdOwner = await createUserAndId("-seriec-owner");
    owner = createdOwner.user;
    const f1 = await createUserAndId("-seriec-f1");
    filler1Id = f1.userId;
    const f2 = await createUserAndId("-seriec-f2");
    filler2Id = f2.userId;
    const createdJoiner = await createUserAndId("-seriec-joiner");
    joiner = createdJoiner.user;
    courtCId = await createCourt(createdOwner.userId, courtCName);
    const { data, error } = await admin()
      .from("lobbies")
      .insert({
        court_id: courtCId,
        creator_id: createdOwner.userId,
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        max_players: 2,
        status: "open",
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("lobby non creata");
    lobbyCId = (data as { id: string }).id;
  });

  test.afterAll(async () => {
    const a = admin();
    if (lobbyCId) {
      await a.from("lobby_participants").delete().eq("lobby_id", lobbyCId);
      await a.from("lobbies").delete().eq("id", lobbyCId);
    }
    if (courtCId) await a.from("courts").delete().eq("id", courtCId);
    for (const u of [owner, joiner]) {
      if (u) await deleteUserByEmail(u.email);
    }
    // Filler: solo gli id, le email non sono state tenute.
    try {
      const { data } = await a.auth.admin.listUsers({ perPage: 200 });
      for (const id of [filler1Id, filler2Id]) {
        const found = data?.users.find((x) => x.id === id);
        if (found?.email) await a.auth.admin.deleteUser(found.id);
      }
    } catch {
      // Best-effort.
    }
  });

  test("join oltre capienza: testo italiano, niente codici, niente Riprova", async ({
    page,
  }) => {
    // Niente trackConsoleErrors qui: il 400 di PostgREST sul join rifiutato
    // è il percorso esercitato, e il browser lo registra in console anche
    // quando l'app lo gestisce (come da contratto #77).
    //
    // Il realtime resta congelato per tutto il test: con le props aggiornate
    // la guardia client `isFull` (`lobby-detail.tsx`) mostrerebbe lo stesso
    // "Posti esauriti" senza toccare il DB (falso verde). Senza websocket la
    // pagina resta ferma a 0 partecipanti e l'unico percorso possibile al
    // messaggio è l'INSERT rifiutato dal trigger 045, via
    // `postgrestErrorFields` → `mapJoinError`. La prova che le props sono
    // stale è la CTA "Unisciti" ancora visibile a lobby piena: col refresh
    // sarebbe sparita in "Al completo".
    // (`routeWebSocket` + close: `page.route` non intercetta i websocket.)
    await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => ws.close());
    await loginViaUI(page, joiner);
    await page.goto(`/lobbies/${lobbyCId}`);
    await expect(
      page.getByRole("button", { name: "Unisciti" }),
    ).toBeVisible({ timeout: 15_000 });

    // La lobby si riempie mentre la pagina è ferma a 0 partecipanti…
    const { error: fillError } = await admin()
      .from("lobby_participants")
      .insert([
        { lobby_id: lobbyCId, user_id: filler1Id },
        { lobby_id: lobbyCId, user_id: filler2Id },
      ]);
    if (fillError) throw fillError;

    // …e la CTA resta (finestra al refresh, poi prova di stale): con le
    // props rientrate il bottone non esisterebbe più.
    await page.waitForTimeout(2_500);
    await expect(
      page.getByRole("button", { name: "Unisciti" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Unisciti" }).click();
    await expect(
      page.getByRole("button", { name: "Entra" }),
    ).toBeVisible({ timeout: 10_000 });

    // …quindi l'Entra parte davvero e l'INSERT viene rifiutato dal trigger:
    // `#103`: il DB rifiuta con `P0001 — Lobby al completo` (corpo 400) e
    // `confirmJoin` in `components/lobby/lobby-detail.tsx` passa l'oggetto
    // PostgREST al mapper via `postgrestErrorFields` (con
    // `shouldThrowOnError` a false non è un'istanza di Error): la forma è
    // quella forte di `mapJoinError`, non il generico.
    await page.getByRole("button", { name: "Entra" }).click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText(/Posti esauriti/);
    await expect(alert).not.toContainText(/Non è stato possibile unirti/);
    await expect(alert).not.toContainText(/P0001|23514|23505|42501/);
    await expect(
      page.getByRole("button", { name: "Riprova", exact: true }),
    ).toHaveCount(0);
    await expectNoDbCodes(page);
    // Niente ottimistico bloccato: niente "Sei dentro".
    await expect(page.getByText("Sei dentro.")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Orfana (creatore senza account): spegne chi ha partecipato a
// un'occorrenza passata (28 giorni), non chi ha solo una futura.
// ---------------------------------------------------------------------------
test.describe("serie orfana: kill-switch dei partecipanti recenti", () => {
  test.skip(!process.env.E2E_WITH_DB, SKIP_MSG);
  test.setTimeout(120_000);

  let pastUser: TestUser;
  let futureUser: TestUser;
  let courtDId = "";
  const stamp = Date.now();
  const courtDName = `Campo Orfana E2E ${stamp}`;
  let orphanSeriesId = "";
  let pastLobbyId = "";
  let futureLobbyId = "";

  test.beforeAll(async () => {
    const createdPast = await createUserAndId("-seried-past");
    pastUser = createdPast.user;
    const createdFuture = await createUserAndId("-seried-future");
    futureUser = createdFuture.user;
    courtDId = await createCourt(createdPast.userId, courtDName);

    const a = admin();
    // La regola punta all'occorrenza futura (coerenza regola/prossima).
    const futureStart = plusDaysRounded(5);
    const rp = romeParts(futureStart);
    const { data: srow, error: serror } = await a
      .from("lobby_series")
      .insert({
        court_id: courtDId,
        creator_id: null,
        weekday: rp.weekday,
        time_of_day: rp.time,
      })
      .select("id")
      .single();
    if (serror || !srow) throw serror ?? new Error("serie orfana non creata");
    orphanSeriesId = (srow as { id: string }).id;

    // Occorrenza passata (3 giorni fa) con conferma di pastUser…
    const pastStart = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const { data: prow, error: perror } = await a
      .from("lobbies")
      .insert({
        court_id: courtDId,
        creator_id: createdPast.userId,
        start_time: pastStart,
        max_players: 10,
        status: "open",
        series_id: orphanSeriesId,
      })
      .select("id")
      .single();
    if (perror || !prow) throw perror ?? new Error("occorrenza passata fallita");
    pastLobbyId = (prow as { id: string }).id;
    const { error: pperror } = await a.from("lobby_participants").insert({
      lobby_id: pastLobbyId,
      user_id: createdPast.userId,
    });
    if (pperror) throw pperror;

    // …e occorrenza futura con conferma del solo futureUser.
    const { data: frow, error: ferror } = await a
      .from("lobbies")
      .insert({
        court_id: courtDId,
        creator_id: createdFuture.userId,
        start_time: futureStart,
        max_players: 10,
        status: "open",
        series_id: orphanSeriesId,
      })
      .select("id")
      .single();
    if (ferror || !frow) throw ferror ?? new Error("occorrenza futura fallita");
    futureLobbyId = (frow as { id: string }).id;
    const { error: fperror } = await a.from("lobby_participants").insert({
      lobby_id: futureLobbyId,
      user_id: createdFuture.userId,
    });
    if (fperror) throw fperror;
  });

  test.afterAll(async () => {
    const a = admin();
    for (const id of [pastLobbyId, futureLobbyId]) {
      if (id) await a.from("lobby_participants").delete().eq("lobby_id", id);
    }
    for (const id of [pastLobbyId, futureLobbyId]) {
      if (id) await a.from("lobbies").delete().eq("id", id);
    }
    if (orphanSeriesId) {
      await a.from("lobby_series").delete().eq("id", orphanSeriesId);
    }
    if (courtDId) await a.from("courts").delete().eq("id", courtDId);
    if (pastUser) await deleteUserByEmail(pastUser.email);
    if (futureUser) await deleteUserByEmail(futureUser.email);
  });

  test("chi ha partecipato a un'occorrenza passata vede e usa Ferma la serie", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, pastUser);
    await page.goto("/lobbies?tab=serie");
    const panel = page.locator("#panel-serie");
    await expect(panel.getByText("Senza organizzatore")).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByText(courtDName)).toBeVisible();
    // Niente switch sull'orfana (kill-switch irreversibile, decisione #92.4).
    await expect(panel.getByRole("switch")).toHaveCount(0);
    await expect(
      panel.getByText(/Chi ha creato la serie non ha più un account/),
    ).toBeVisible();

    await panel.getByRole("button", { name: /Ferma la serie/ }).click();
    const confirmGroup = panel.getByRole("group", {
      name: /Conferma chiusura della serie/,
    });
    await expect(confirmGroup).toBeVisible({ timeout: 10_000 });
    await expect(confirmGroup).toBeFocused();
    await expect(
      panel.getByText(/Fermiamo la serie: non verranno create altre partite/),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Sì, ferma la serie" }).click();
    await expect(panel.getByText("Senza organizzatore")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(panel.getByText(courtDName)).toHaveCount(0);

    // La scrittura REST può ancora essere in volo quando l'ottimistico ha
    // già nascosto la riga: si attende il commit, non l'istante.
    await expect
      .poll(
        async () => {
          const { data } = await admin()
            .from("lobby_series")
            .select("active")
            .eq("id", orphanSeriesId)
            .single();
          return (data as { active: boolean } | null)?.active;
        },
        { timeout: 10_000 },
      )
      .toBe(false);
    orphanSeriesId = "";

    tracker.assertClean();
  });

  test("chi ha solo un'occorrenza futura non vede il controllo", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await loginViaUI(page, futureUser);
    await page.goto("/lobbies?tab=serie");
    const panel = page.locator("#panel-serie");
    await expect(panel.getByText("Nessuna serie")).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByText("Senza organizzatore")).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: /Ferma la serie/ }),
    ).toHaveCount(0);
    tracker.assertClean();
  });
});
