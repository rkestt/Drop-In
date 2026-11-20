import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

// Cancellazione account (#94 decisione, #101): i quattro casi con due utenti
// veri dedicati, mai quelli di storage-state.json. Vuole Supabase locale +
// dev server (alzato da Playwright via webServer).
test.describe("account deletion", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/account-deletion.spec.ts --project=e2e",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

  const AUTH_STATE_A = "/tmp/opencode/del-a-auth.json";
  const AUTH_STATE_B = "/tmp/opencode/del-b-auth.json";
  const AVATAR_BUCKET = "avatars";

  // 1x1 PNG: basta che il bucket abbia un oggetto sotto `<uid>/`.
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  let userA: TestUser;
  let userB: TestUser;
  let uidA = "";
  let uidB = "";
  let lobbyId = "";
  let courtId = "";
  let courtName = "";
  // Marker unico scritto da B: se l'export di A lo contenesse, A vedrebbe
  // righe altrui.
  let bSecret = "";

  function serviceClient() {
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  test.beforeAll(async ({ browser }) => {
    userA = await createConfirmedUser("-del-a");
    userB = await createConfirmedUser("-del-b");
    bSecret = `recensione-segreta-di-B-${Date.now()}`;
    uidA = userA.id;
    uidB = userB.id;
    try {
      const admin = serviceClient();

      // Una corte vera dal seed.
      const { data: court, error: courtError } = await createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      )
        .from("courts")
        .select("id, name")
        .limit(1)
        .single();
      if (courtError || !court) throw courtError ?? new Error("seed assente");
      courtId = (court as { id: string }).id;
      courtName = (court as { name: string }).name;

      // A crea una lobby futura open, B si iscrive.
      const { data: lobby, error: lobbyError } = await admin
        .from("lobbies")
        .insert({
          court_id: courtId,
          creator_id: uidA,
          start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          max_players: 10,
          status: "open",
        })
        .select("id")
        .single();
      if (lobbyError || !lobby)
        throw lobbyError ?? new Error("lobby non creata");
      lobbyId = (lobby as { id: string }).id;

      const { error: joinError } = await admin
        .from("lobby_participants")
        .insert({ lobby_id: lobbyId, user_id: uidB });
      if (joinError) throw joinError;

      // B scrive una recensione con marker: nell'export di A non deve
      // comparire mai.
      const { error: reviewError } = await admin
        .from("court_reviews")
        .insert({ court_id: courtId, user_id: uidB, rating: 4, body: bSecret });
      if (reviewError) throw reviewError;

      // Avatar di A nello storage, sotto il suo prefisso.
      const { error: uploadError } = await admin.storage
        .from(AVATAR_BUCKET)
        .upload(`${uidA}/e2e-avatar.png`, PNG_1X1, {
          contentType: "image/png",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      // Login via UI per entrambi, stati separati.
      const pageA = await browser.newPage({
        storageState: { cookies: [], origins: [] },
      });
      try {
        await loginViaUI(pageA, userA);
        await pageA.context().storageState({ path: AUTH_STATE_A });
      } finally {
        await pageA.close();
      }
      const pageB = await browser.newPage({
        storageState: { cookies: [], origins: [] },
      });
      try {
        await loginViaUI(pageB, userB);
        await pageB.context().storageState({ path: AUTH_STATE_B });
      } finally {
        await pageB.close();
      }
    } catch (e) {
      // Fixture a metà: non lasciare utenti orfani nel DB locale, né
      // l'avatar di A (il POST non girerà mai per cancellarlo).
      const admin = serviceClient();
      if (lobbyId) {
        await admin.from("lobby_participants").delete().eq("lobby_id", lobbyId);
        await admin.from("lobbies").delete().eq("id", lobbyId);
        lobbyId = "";
      }
      if (uidA !== "") {
        await admin.storage
          .from(AVATAR_BUCKET)
          .remove([`${uidA}/e2e-avatar.png`]);
      }
      for (const id of [userA?.id, userB?.id]) {
        try {
          if (id) await admin.auth.admin.deleteUser(id);
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
      if (lobbyId) {
        await admin.from("lobby_participants").delete().eq("lobby_id", lobbyId);
        await admin.from("lobbies").delete().eq("id", lobbyId);
      }
      if (uidA !== "") {
        await admin.storage
          .from(AVATAR_BUCKET)
          .remove([`${uidA}/e2e-avatar.png`]);
      }
    } finally {
      for (const id of [userA?.id, userB?.id]) {
        try {
          if (!id) continue;
          await admin.auth.admin.deleteUser(id);
        } catch {
          // best-effort: lo spec ha già detto la sua
        }
      }
    }
  });

  test("1. export: solo le proprie righe, FK in nomi leggibili", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_A });
    try {
      const page = await ctx.newPage();
      const res = await page.request.get("/api/account/export");
      expect(res.status()).toBe(200);
      expect(res.headers()["content-disposition"] ?? "").toContain(
        "attachment",
      );
      const body = await res.text();

      // Niente dell'altro utente: né user_id né righe sue.
      expect(body).not.toContain(uidB);
      expect(body).not.toContain(bSecret);
      // Le FK sono nomi leggibili, non UUID: la corte compare col nome.
      expect(body).toContain(courtName);
      // Identità dell'esportatore presente.
      expect(body).toContain(userA.email);

      const json = JSON.parse(body) as {
        lobby_create: Array<{ campo: unknown; altri_iscritti: unknown }>;
      };
      expect(json.lobby_create.length).toBeGreaterThanOrEqual(1);
      // Solo conteggi altrui, mai righe: B è iscritto alla lobby di A.
      const mine = json.lobby_create.find((l) => l.campo === courtName);
      expect(mine).toBeDefined();
      expect(mine?.altri_iscritti).toBe(1);
    } finally {
      await ctx.close();
    }
  });

  test("2. delete con lobby futura condivisa → 409, account intatto", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_A });
    try {
      const page = await ctx.newPage();
      const res = await page.request.post("/api/account/delete");
      expect(res.status()).toBe(409);
      const body = (await res.json()) as { error?: string };
      // Messaggio italiano della route: parla di lobby.
      expect(body.error ?? "").toMatch(/lobby/i);

      // Account intatto: profilo ancora presente, auth ancora vivo.
      const admin = serviceClient();
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", uidA)
        .maybeSingle();
      if (profileError) throw profileError;
      expect(profile).not.toBeNull();
      const { data: still } = await admin.auth.admin.getUserById(uidA);
      expect(still?.user?.id).toBe(uidA);
    } finally {
      await ctx.close();
    }
  });

  test("3. dopo l'uscita di B → 200, creatore NULL, storage vuoto", async ({
    browser,
  }) => {
    const admin = serviceClient();
    // B lascia la lobby: via service role, come fanno le spec esistenti.
    const { error: leaveError } = await admin
      .from("lobby_participants")
      .delete()
      .eq("lobby_id", lobbyId)
      .eq("user_id", uidB);
    if (leaveError) throw leaveError;

    const ctx = await browser.newContext({ storageState: AUTH_STATE_A });
    try {
      const page = await ctx.newPage();
      const res = await page.request.post("/api/account/delete");
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true });

      // La lobby sopravvive senza creatore (SET NULL voluto della 041).
      const { data: lobby, error: lobbyError } = await admin
        .from("lobbies")
        .select("id, creator_id")
        .eq("id", lobbyId)
        .single();
      if (lobbyError) throw lobbyError;
      expect((lobby as { creator_id: string | null }).creator_id).toBeNull();

      // Prefisso storage di A vuoto.
      const { data: leftover, error: listError } = await admin.storage
        .from(AVATAR_BUCKET)
        .list(uidA);
      if (listError) throw listError;
      expect(leftover ?? []).toEqual([]);

      // A non esiste più in auth.
      const { data: gone } = await admin.auth.admin.getUserById(uidA);
      expect(gone?.user ?? null).toBeNull();

      // Dati di B intatti: profilo e auth vivi.
      const { data: profileB, error: profileBError } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", uidB)
        .maybeSingle();
      if (profileBError) throw profileBError;
      expect(profileB).not.toBeNull();
      const { data: userBStill } = await admin.auth.admin.getUserById(uidB);
      expect(userBStill?.user?.id).toBe(uidB);
    } finally {
      await ctx.close();
    }
  });

  test("4. replay con la stessa sessione: mai 500", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_A });
    try {
      const page = await ctx.newPage();
      const res = await page.request.post("/api/account/delete");
      // Dopo il 200 la sessione è revocata (deleteUser revoca): la route
      // legge i cookie, getUser non trova più nessuno → 401. Il `replay:
      // true` del codice scatta solo sul doppio invio concorrente (secondo
      // deleteUser su utente già sparito), non sul replay sequenziale.
      expect(res.status()).toBe(401);
    } finally {
      await ctx.close();
    }
  });
});
