import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createConfirmedUser, loginViaUI, SERVICE_ROLE_KEY } from "./helpers/auth";

// Outbox offline (#24): join/leave accodati offline, inviati al reconnect,
// nessun duplicato. Vuole Supabase locale + utente loggato.
test.describe("offline mutation queue", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/offline-queue.spec.ts",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

  const AUTH_STATE = "/tmp/opencode/outbox-auth.json";

  let lobbyId = "";
  let userId = "";
  let userToken = "";
  let userEmail = "";

  function serviceClient() {
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  function userClient() {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
  }

  async function participantRows(): Promise<Array<{ user_id: string }>> {
    const { data, error } = await userClient()
      .from("lobby_participants")
      .select("user_id")
      .eq("lobby_id", lobbyId);
    if (error) throw error;
    return (data ?? []) as Array<{ user_id: string }>;
  }

  async function adminParticipantRows(): Promise<Array<{ user_id: string }>> {
    const { data, error } = await serviceClient()
      .from("lobby_participants")
      .select("user_id")
      .eq("lobby_id", lobbyId);
    if (error) throw error;
    return (data ?? []) as Array<{ user_id: string }>;
  }

  test.beforeAll(async ({ browser }) => {
    const user = await createConfirmedUser("-outbox");
    userEmail = user.email;

    // Token utente per gli assert via REST "come l'utente".
    const login = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionData, error: signInError } =
      await login.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
    if (signInError || !sessionData.session || !sessionData.user) {
      throw signInError ?? new Error("login REST fallito");
    }
    userId = sessionData.user.id;
    userToken = sessionData.session.access_token;

    const admin = serviceClient();
    const { data: court, error: courtError } = await createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )
      .from("courts")
      .select("id")
      .limit(1)
      .single();
    if (courtError || !court) throw courtError ?? new Error("seed courts assente");

    const { data: lobby, error: lobbyError } = await admin
      .from("lobbies")
      .insert({
        court_id: (court as { id: string }).id,
        creator_id: userId,
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        max_players: 10,
        status: "open",
      })
      .select("id")
      .single();
    if (lobbyError || !lobby) throw lobbyError ?? new Error("lobby non creata");
    lobbyId = (lobby as { id: string }).id;

    const page = await browser.newPage({
      storageState: { cookies: [], origins: [] },
    });
    try {
      await loginViaUI(page, user);
      await page.context().storageState({ path: AUTH_STATE });
    } finally {
      await page.close();
    }
  });

  test.afterAll(async () => {
    const admin = serviceClient();
    if (lobbyId) {
      await admin.from("lobby_participants").delete().eq("lobby_id", lobbyId);
      await admin.from("lobbies").delete().eq("id", lobbyId);
    }
    if (userEmail) {
      const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
      const prev = data?.users.find((u) => u.email === userEmail);
      if (prev) await admin.auth.admin.deleteUser(prev.id);
    }
  });

  test.describe("con sessione", () => {
    test.use({ storageState: AUTH_STATE });

    test("join offline → in coda → inviato al reconnect senza duplicati", async ({
      page,
      context,
    }) => {
      await page.goto(`/lobbies/${lobbyId}`);
      await expect(
        page.getByRole("button", { name: "Unisciti" }),
      ).toBeVisible({ timeout: 15_000 });
      expect(await participantRows()).toEqual([]);

      await context.setOffline(true);
      await page.getByRole("button", { name: "Unisciti" }).click();
      await page.getByRole("button", { name: "Entra" }).click();

      // Stato visibile: 1 in coda, UI ottimistica "dentro".
      await expect(page.getByTestId("outbox-banner")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Sei dentro/i).first()).toBeVisible({
        timeout: 10_000,
      });
      // La riga NON è sul DB finché siamo offline.
      expect(await adminParticipantRows()).toEqual([]);

      await context.setOffline(false);
      // Entro ~5 s il banner sparisce: flush partito all'evento online.
      await expect(page.getByTestId("outbox-banner")).toBeHidden({ timeout: 10_000 });
      // Esattamente una riga, letta via REST con il token dell'utente.
      await expect
        .poll(async () => participantRows(), { timeout: 10_000 })
        .toHaveLength(1);
      await expect(page.getByText("1 operazione inviata")).toBeVisible({
        timeout: 10_000,
      });

      // Secondo flush forzato: nessun duplicato (UNIQUE + item già rimosso).
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForTimeout(1500);
      expect(await participantRows()).toHaveLength(1);
    });

    test("leave offline → in coda → riga rimossa al reconnect", async ({
      page,
      context,
    }) => {
      await page.goto(`/lobbies/${lobbyId}`);
      await expect(
        page.getByRole("button", { name: "Esci dalla lobby" }),
      ).toBeVisible({ timeout: 15_000 });
      expect(await participantRows()).toHaveLength(1);

      await context.setOffline(true);
      await page.getByRole("button", { name: "Esci dalla lobby" }).click();

      await expect(page.getByTestId("outbox-banner")).toBeVisible({ timeout: 10_000 });
      // La riga è ancora sul DB finché siamo offline.
      expect(await adminParticipantRows()).toHaveLength(1);

      await context.setOffline(false);
      await expect(page.getByTestId("outbox-banner")).toBeHidden({ timeout: 10_000 });
      await expect
        .poll(async () => adminParticipantRows(), { timeout: 10_000 })
        .toEqual([]);
    });
  });
});
