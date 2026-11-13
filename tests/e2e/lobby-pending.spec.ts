import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { trackConsoleErrors } from "./helpers/console";
import {
  createConfirmedUser,
  loginViaUI,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./helpers/auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * #76 — deep link su lobby di un campo non approvato: join chiuso, uscita
 * sempre possibile.
 *
 * Fixture: il trigger `require_approved_court_lobbies` (012) vieta di
 * inserire una lobby su una corte non approvata — anche via service role.
 * Quindi si costruisce al contrario, come succede nella realtà quando una
 * corte viene declassata dopo: corte `approved` + lobby sopra, poi update
 * della corte a `pending`. Le lobby restano leggibili ("viewable by
 * everyone", 001), quindi il deep link arriva alla pagina e il gate
 * `courtApproved` in `/lobbies/[id]` deve chiudere il join.
 */
test.describe("lobby su campo non approvato: deep link bloccato", () => {
  let user: TestUser | null = null;
  let userId = "";
  let pendingCourtId = "";
  let openLobbyId = "";
  let joinedLobbyId = "";
  let setupError: string | null = null;

  test.beforeAll(async () => {
    try {
      user = await createConfirmedUser("-lobbypending");
    } catch (err) {
      setupError = `skip: serve Supabase locale con service role (${
        err instanceof Error ? err.message : err
      })`;
      return;
    }

    const admin = adminClient();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } =
      await anon.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
    if (signInError || !signIn.user) {
      setupError = `skip: login utente e2e fallito (${signInError?.message})`;
      return;
    }
    userId = signIn.user.id;

    const stamp = Date.now();
    const { data: courts, error: courtError } = await admin
      .from("courts")
      .insert([
        {
          name: `Campo Pending Lobby E2E ${stamp}`,
          lat: 41.9028,
          lng: 12.4964,
          moderation_status: "approved",
          submitted_by: userId,
          source: "community",
          status: "active",
        },
      ])
      .select("id");
    if (courtError || !courts || courts.length !== 1) {
      setupError = `skip: insert corte pending fallito (${courtError?.message})`;
      return;
    }
    pendingCourtId = courts[0].id as string;

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data: lobbies, error: lobbyError } = await admin
      .from("lobbies")
      .insert([
        {
          court_id: pendingCourtId,
          creator_id: userId,
          start_time: start,
          max_players: 10,
          status: "open",
        },
        {
          court_id: pendingCourtId,
          creator_id: userId,
          start_time: start,
          max_players: 10,
          status: "open",
        },
      ])
      .select("id");
    if (lobbyError || !lobbies || lobbies.length !== 2) {
      setupError = `skip: insert lobby su pending fallito (${lobbyError?.message})`;
      return;
    }
    openLobbyId = lobbies[0].id as string;
    joinedLobbyId = lobbies[1].id as string;

    // Declassamento DOPO la creazione (unico ordine possibile, vedi sopra):
    // riproduce il caso reale di una corte revocata con lobby già aperte.
    const { error: demoteError } = await admin
      .from("courts")
      .update({ moderation_status: "pending" })
      .eq("id", pendingCourtId);
    if (demoteError) {
      setupError = `skip: declassamento corte fallito (${demoteError.message})`;
      return;
    }

    // L'utente partecipa alla seconda lobby: il gate deve bloccare il
    // join ma lasciare l'uscita.
    const { error: joinError } = await admin
      .from("lobby_participants")
      .insert({ lobby_id: joinedLobbyId, user_id: userId });
    if (joinError) {
      setupError = `skip: insert partecipazione fallito (${joinError.message})`;
    }
  });

  test.afterAll(async () => {
    try {
      const admin = adminClient();
      for (const id of [openLobbyId, joinedLobbyId]) {
        if (id) await admin.from("lobby_participants").delete().eq("lobby_id", id);
      }
      for (const id of [openLobbyId, joinedLobbyId]) {
        if (id) await admin.from("lobbies").delete().eq("id", id);
      }
      if (pendingCourtId) {
        await admin.from("courts").delete().eq("id", pendingCourtId);
      }
      if (user) {
        const email = user.email;
        const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
        const prev = data?.users.find((u) => u.email === email);
        if (prev) await admin.auth.admin.deleteUser(prev.id);
      }
    } catch {
      // Best-effort.
    }
  });

  test("deep link: avviso di blocco e niente join", async ({ page }) => {
    test.skip(setupError !== null, setupError ?? "");
    const tracker = await trackConsoleErrors(page);

    await loginViaUI(page, user!);
    await page.goto(`/lobbies/${openLobbyId}`);

    await expect(
      page.getByText(/lobby non disponibile: il campo è in attesa di approvazione/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /^unisciti$/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /esci dalla lobby/i })
    ).toHaveCount(0);

    tracker.assertClean();
  });

  test("partecipante: il blocco resta ma l'uscita funziona", async ({
    page,
  }) => {
    test.skip(setupError !== null, setupError ?? "");
    const tracker = await trackConsoleErrors(page);

    await loginViaUI(page, user!);
    await page.goto(`/lobbies/${joinedLobbyId}`);

    await expect(
      page.getByText(/lobby non disponibile: il campo è in attesa di approvazione/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /^unisciti$/i })
    ).toHaveCount(0);

    const leave = page.getByRole("button", { name: /esci dalla lobby/i });
    await expect(leave).toBeVisible();
    await leave.click();

    // Uscita riuscita: niente più CTA (join comunque chiuso dal gate),
    // resta solo l'avviso di blocco.
    await expect(
      page.getByRole("button", { name: /esci dalla lobby/i })
    ).toHaveCount(0);
    await expect(
      page.getByText(/lobby non disponibile: il campo è in attesa di approvazione/i)
    ).toBeVisible();

    tracker.assertClean();
  });
});
