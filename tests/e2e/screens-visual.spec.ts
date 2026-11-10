import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createConfirmedUser, loginViaUI } from "./helpers/auth";
import {
  VISUAL_VIEWPORTS,
  VISUAL_SHOT,
  freezeClock,
  seedOnboarded,
  visualMask,
  waitForStablePage,
} from "./helpers/visual";

// Visual regression full (d27): 11 schermate × 3 viewport (360×780,
// 768×1024, 1280×800), pagina intera, diff massimo 1%.
//
// - `visual-static`: senza Supabase, gira anche in CI (/styleguide,
//   /~offline, /submit-court).
// - `visual-full`: con Supabase locale + E2E_WITH_DB=1, solo in locale
//   (seed deterministico, utente di test, lobby creata nel setup).
// - Onboarding: `/` con localStorage vuoto, nel gruppo full.
//
// Determinismo: clock fisso (9 nov 2026 18:00 Europe/Rome, vedi
// `timezoneId` in playwright.config.ts), font locali + `document.fonts.ready`,
// maschere mirate su `[data-visual-mask]` (mappa WebGL/tile/marker). Mai
// `waitForTimeout` come unica attesa.

const STATIC_SCREENS = [
  {
    name: "styleguide",
    url: "/styleguide",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "Styleguide" }),
  },
  {
    name: "offline",
    url: "/~offline",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "Sei offline." }),
  },
  {
    name: "submit-court",
    url: "/submit-court",
    ready: (page: Page) => page.locator("h1"),
  },
] as const;

test.describe("visual-static", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const screen of STATIC_SCREENS) {
    for (const { width, height } of VISUAL_VIEWPORTS) {
      test(`${screen.name} @ ${width}px`, async ({ page }) => {
        await seedOnboarded(page);
        await page.setViewportSize({ width, height });
        await freezeClock(page);
        await page.goto(screen.url);
        await waitForStablePage(page, screen.ready(page));
        await expect(page).toHaveScreenshot(
          `${screen.name}-${width}.png`,
          { ...VISUAL_SHOT, mask: visualMask(page) },
        );
      });
    }
  }
});

// --- Gruppo con DB (E2E_WITH_DB=1) ------------------------------------

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const VISUAL_EMAIL = "visual@dropin.test";
const VISUAL_NICKNAME = "visual_tester";
// Lobby creata nel setup con ID noto: stesso giorno del clock fisso
// (9 nov 2026), inizio 19:00 → "Oggi" + orario assoluto, deterministici.
const VISUAL_LOBBY_ID = "9a0bc1de-f4a7-4b2c-8d3e-000000000001";
const VISUAL_LOBBY_START = "2026-11-09T19:00:00+01:00";

const AUTH_STATE = "/tmp/opencode/visual-auth.json";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJ-qWv8Hdp7fsn3WqYpN81IU";

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe("visual-full", () => {
  test.skip(
    !process.env.E2E_WITH_DB,
    "Richiede Supabase locale: E2E_WITH_DB=1 npm run test:visual:full",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let courtId = "";
  let lobbyId = VISUAL_LOBBY_ID;

  test.beforeAll(async ({ browser }) => {
    const admin = serviceClient();
    // Utente deterministico: elimina l'eventuale residuo di un run
    // precedente, poi ricrea con email/nickname fissi.
    const { data: users } = await admin.auth.admin.listUsers();
    const prev = users?.users.find((u) => u.email === VISUAL_EMAIL);
    if (prev) await admin.auth.admin.deleteUser(prev.id);
    const user = await createConfirmedUser("visual");
    // Forza email/nickname noti (createConfirmedUser li genera casuali).
    const { data: created } = await admin.auth.admin.listUsers();
    const row = created?.users.find((u) => u.email === user.email);
    if (!row) throw new Error("visual user non creato");
    await admin.auth.admin.updateUserById(row.id, { email: VISUAL_EMAIL });
    await admin
      .from("profiles")
      .update({ nickname: VISUAL_NICKNAME })
      .eq("user_id", row.id);

    // Campo deterministico: prima riga del seed ordinata per osm_id
    // (gli UUID cambiano a ogni `db reset`, i dati OSM no).
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: court, error: courtError } = await anon
      .from("courts")
      .select("id")
      .order("osm_id")
      .limit(1)
      .single();
    if (courtError || !court) throw new Error("seed courts assente");
    courtId = court.id;

    // Solo la nostra lobby: via i residui di altri run, poi inserisce
    // quella con ID noto (così `/` e `/lobbies` mostrano sempre una sola
    // card con orario fisso).
    await admin.from("lobby_participants").delete().neq("lobby_id", "00000000-0000-0000-0000-000000000000");
    await admin.from("lobbies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: lobbyError } = await admin.from("lobbies").insert({
      id: VISUAL_LOBBY_ID,
      court_id: courtId,
      creator_id: row.id,
      start_time: VISUAL_LOBBY_START,
      max_players: 10,
      status: "open",
    });
    if (lobbyError) throw lobbyError;
    const { error: partError } = await admin
      .from("lobby_participants")
      .insert({ lobby_id: VISUAL_LOBBY_ID, user_id: row.id });
    if (partError) throw partError;
    lobbyId = VISUAL_LOBBY_ID;

    const page = await browser.newPage({
      storageState: { cookies: [], origins: [] },
    });
    try {
      await loginViaUI(page, {
        email: VISUAL_EMAIL,
        password: "dropin-a11y-pass",
        nickname: VISUAL_NICKNAME,
      });
      await page.context().storageState({ path: AUTH_STATE });
    } finally {
      await page.close();
    }
  });

  test.describe("autenticato", () => {
    test.use({ storageState: AUTH_STATE });

    // `url` è una thunk: courtId/lobbyId esistono solo dopo il beforeAll,
    // mentre la lista schermate si definisce in fase di collection.
    const fullScreens: Array<{
      name: string;
      url: () => string;
      ready: (page: Page) => import("@playwright/test").Locator;
    }> = [
      {
        name: "home",
        url: () => "/",
        ready: (page: Page) =>
          page.getByRole("heading", { name: "Partite vicine" }),
      },
      {
        name: "court-detail",
        url: () => `/courts/${courtId}`,
        ready: (page: Page) => page.locator("h1"),
      },
      {
        name: "lobbies",
        url: () => "/lobbies",
        ready: (page: Page) => page.locator("#contenuto"),
      },
      {
        name: "lobby-detail",
        url: () => `/lobbies/${lobbyId}`,
        ready: (page: Page) => page.locator("#contenuto"),
      },
      {
        name: "profile",
        url: () => "/profile",
        ready: (page: Page) =>
          page.getByRole("heading", { name: "Profilo" }),
      },
      {
        name: "settings",
        url: () => "/settings",
        ready: (page: Page) =>
          page.getByRole("heading", { name: "Impostazioni" }),
      },
      {
        name: "notifications",
        url: () => "/notifications",
        ready: (page: Page) =>
          page.getByRole("heading", { name: "Notifiche" }),
      },
    ];

    for (const { width, height } of VISUAL_VIEWPORTS) {
      for (const screen of fullScreens) {
        test(`${screen.name} @ ${width}px`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await freezeClock(page);
          await page.goto(screen.url());
          await waitForStablePage(page, screen.ready(page));
          await expect(page).toHaveScreenshot(
            `${screen.name}-${width}.png`,
            { ...VISUAL_SHOT, mask: visualMask(page) },
          );
        });
      }
    }
  });

  test.describe("onboarding", () => {
    // Primo avvio: localStorage vuoto, nessun flag.
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const { width, height } of VISUAL_VIEWPORTS) {
      test(`onboarding @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await freezeClock(page);
        await page.goto("/");
        await waitForStablePage(
          page,
          page.getByRole("button", { name: "Salta il primo avvio" }),
        );
        await expect(page).toHaveScreenshot(`onboarding-${width}.png`, {
          ...VISUAL_SHOT,
          mask: visualMask(page),
        });
      });
    }
  });
});
