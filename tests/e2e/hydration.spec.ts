import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createConfirmedUser, loginViaUI, SERVICE_ROLE_KEY } from "./helpers/auth";

// Idratazione #78: `toLocale*` senza `timeZone` rendeva testi diversi tra
// SSR (UTC) e browser (Rome) → React error #418. Apre `/`, `/lobbies`,
// `/lobbies/<seeded id>`, `/courts/<approved id>` e `/profile` e fallisce su
// qualsiasi errore console che puzza di mismatch. Vuole Supabase locale +
// utente loggato.
//
// NOTA TZ: `reuseExistingServer: true` (playwright.config.ts) significa che
// un `next dev` già avviato a mano viene riusato con LA SUA TZ. La garanzia
// "server in UTC" vale solo se il server lo avvia Playwright (o se quello
// esistente gira già con `TZ=UTC`): prima di lanciare, killare gli altri
// dev server (`pkill -f "next dev"` o `lsof -ti:3100 | xargs kill`).
test.describe("hydration senza mismatch", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npx playwright test tests/e2e/hydration.spec.ts",
  );
  test.setTimeout(120_000);
  // Browser a Roma, server in UTC (playwright.config.ts webServer env):
  // e' la combinazione reale di stage/prod ed e' quella che fa emergere il
  // mismatch se un formatter perde `timeZone`.
  test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

  const AUTH_STATE = "/tmp/opencode/hydration-auth.json";
  const HYDRATION_RE = /Minified React error #418|Hydration failed|did not match/i;

  let lobbyId = "";
  let courtId = "";
  let userEmail = "";

  function serviceClient() {
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  test.beforeAll(async ({ browser }) => {
    const user = await createConfirmedUser("-hydration");
    userEmail = user.email;

    const admin = serviceClient();
    const { data: usersData } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    const creatorId = usersData?.users.find((u) => u.email === user.email)?.id;
    if (!creatorId) throw new Error("utente appena creato non trovato");

    // Via anon: la RLS (courts_select_all) mostra solo le `approved`,
    // quindi questa è una corte approvata buona per `/courts/[id]`.
    const { data: court, error: courtError } = await createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )
      .from("courts")
      .select("id")
      .limit(1)
      .single();
    if (courtError || !court) throw courtError ?? new Error("seed courts assente");
    courtId = (court as { id: string }).id;

    const { data: lobby, error: lobbyError } = await admin
      .from("lobbies")
      .insert({
        court_id: (court as { id: string }).id,
        creator_id: creatorId,
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

    for (const path of ["/", "/lobbies"] as const) {
      test(`nessun hydration error su ${path}`, async ({ page }) => {
        const hits: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error" && HYDRATION_RE.test(msg.text())) {
            hits.push(msg.text());
          }
        });
        page.on("pageerror", (err) => {
          if (HYDRATION_RE.test(String(err))) hits.push(String(err));
        });
        await page.goto(path);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1_500);
        expect(hits).toEqual([]);
      });
    }

    test("nessun hydration error su /lobbies/[id]", async ({ page }) => {
      const hits: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && HYDRATION_RE.test(msg.text())) {
          hits.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        if (HYDRATION_RE.test(String(err))) hits.push(String(err));
      });
      await page.goto(`/lobbies/${lobbyId}`);
      // Dettaglio SSR con orari: il render deve restare stabile.
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 15_000,
      });
      await page.waitForTimeout(1_500);
      expect(hits).toEqual([]);
    });

    test("nessun hydration error su /courts/[id] approvata", async ({
      page,
    }) => {
      const hits: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && HYDRATION_RE.test(msg.text())) {
          hits.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        if (HYDRATION_RE.test(String(err))) hits.push(String(err));
      });
      await page.goto(`/courts/${courtId}`);
      // Date lobby e scadenze report: render SSR con orari a Roma.
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 15_000,
      });
      await page.waitForTimeout(1_500);
      expect(hits).toEqual([]);
    });

    test("nessun hydration error su /profile", async ({ page }) => {
      const hits: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && HYDRATION_RE.test(msg.text())) {
          hits.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        if (HYDRATION_RE.test(String(err))) hits.push(String(err));
      });
      await page.goto("/profile");
      // Storico con chiavi giorno e date karma: tutto SSR pinnato a Roma.
      await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible(
        {
          timeout: 15_000,
        }
      );
      await page.waitForTimeout(1_500);
      expect(hits).toEqual([]);
    });
  });
});
