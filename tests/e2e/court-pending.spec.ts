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
 * #76 — campo non approvato: niente CTA operative.
 *
 * Le fixture non esistono nel seed (i seed sono tutti `approved` per
 * default), quindi vengono create al volo via service role — lo stesso
 * pattern già usato da `helpers/auth.ts` per gli utenti di test, con
 * fallback solo su URL locale. Niente chiamate a prod/stage: se il
 * Supabase locale non risponde o la service key manca, gli spec skippano
 * con motivazione invece di fallire (flag `setupError`, come in origine).
 */
test.describe("campo non approvato: niente CTA operative", () => {
  let user: TestUser | null = null;
  let userId = "";
  let pendingCourtId = "";
  let pendingCourtName = "";
  let rejectedCourtId = "";
  let rejectedCourtName = "";
  let setupError: string | null = null;

  test.beforeAll(async () => {
    try {
      user = await createConfirmedUser("-pending");
    } catch (err) {
      setupError = `skip: serve Supabase locale con service role (${
        err instanceof Error ? err.message : err
      })`;
      return;
    }

    const admin = adminClient();

    // Id utente per submitted_by: login anon (conferma anche le credenziali).
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
    pendingCourtName = `Campo Pending E2E ${stamp}`;
    rejectedCourtName = `Campo Rejected E2E ${stamp}`;
    const { data: courts, error: insertError } = await admin
      .from("courts")
      .insert([
        {
          name: pendingCourtName,
          lat: 41.9028,
          lng: 12.4964,
          moderation_status: "pending",
          submitted_by: userId,
          source: "community",
          status: "active",
        },
        {
          name: rejectedCourtName,
          lat: 41.9029,
          lng: 12.4965,
          moderation_status: "rejected",
          submitted_by: userId,
          source: "community",
          status: "active",
        },
      ])
      .select("id, name");
    if (insertError || !courts || courts.length !== 2) {
      setupError = `skip: insert corti non approvate fallito (${insertError?.message})`;
      return;
    }
    pendingCourtId =
      courts.find((c) => c.name === pendingCourtName)?.id ?? "";
    rejectedCourtId =
      courts.find((c) => c.name === rejectedCourtName)?.id ?? "";
    if (!pendingCourtId || !rejectedCourtId) {
      setupError = "skip: id corti fixture non restituiti dall'insert";
    }
  });

  test.afterAll(async () => {
    // Pulizia best-effort: le corti di test non devono restare nel DB
    // locale — e l'utente `-pending` nemmeno (pattern listUsers+deleteUser
    // da hydration.spec.ts).
    try {
      const admin = adminClient();
      for (const id of [pendingCourtId, rejectedCourtId]) {
        if (id) await admin.from("courts").delete().eq("id", id);
      }
      if (user) {
        const email = user.email;
        const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
        const prev = data?.users.find((u) => u.email === email);
        if (prev) await admin.auth.admin.deleteUser(prev.id);
      }
    } catch {
      // Best-effort: un fallimento qui non deve far fallire la suite.
    }
  });

  test("pending mostra avviso e niente CTA operative", async ({ page }) => {
    test.skip(setupError !== null, setupError ?? "");
    const tracker = await trackConsoleErrors(page);

    // Il proprietario vede la sua pending (policy courts_select_all).
    await loginViaUI(page, user!);
    await page.goto(`/courts/${pendingCourtId}`);

    // Avviso di revisione, non CTA operative.
    await expect(
      page.getByRole("heading", { name: "In attesa di approvazione" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/in revisione: check-in e lobby/i)
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /check-in|sei qui/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /crea lobby/i })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /segnala/i })).toHaveCount(0);
    // Niente prompt di login al suo posto.
    await expect(page.getByText(/accedi per continuare/i)).toHaveCount(0);
    // Sezione lobby: spiegazione del blocco, non lista né crea-lobby.
    await expect(
      page.getByText(/le lobby si sbloccano quando il campo viene approvato/i)
    ).toBeVisible();

    tracker.assertClean();
  });

  test("sloggato: niente CTA e niente LoginPrompt sulla pending", async ({
    page,
  }) => {
    test.skip(setupError !== null, setupError ?? "");
    const tracker = await trackConsoleErrors(page);

    // RLS (courts_select_all): anon vede solo le corti `approved`, quindi
    // la pending non esiste proprio per lui (404) — l'importante è che non
    // trapeli nulla di azionabile: niente CTA, niente LoginPrompt che
    // tradisca l'esistenza del campo, niente nome del campo.
    await page.goto(`/courts/${pendingCourtId}`);
    await expect(
      page.getByRole("heading", { name: "In attesa di approvazione" })
    ).toHaveCount(0);
    await expect(page.getByText(pendingCourtName)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /check-in|sei qui/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /crea lobby/i })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /segnala/i })).toHaveCount(0);
    await expect(page.getByText(/accedi per continuare/i)).toHaveCount(0);

    tracker.assertClean();
  });

  test("rejected mostra copy specifico e niente CTA operative", async ({
    page,
  }) => {
    test.skip(setupError !== null, setupError ?? "");
    const tracker = await trackConsoleErrors(page);

    // Il proprietario vede la sua rejected (policy courts_select_all).
    await loginViaUI(page, user!);
    await page.goto(`/courts/${rejectedCourtId}`);

    // Copy specifico della rejected, mai "in revisione".
    await expect(
      page.getByRole("heading", { name: "Campo non approvato" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/non è stato approvato: check-in e lobby restano chiusi/i)
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "In attesa di approvazione" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /check-in|sei qui/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /crea lobby/i })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /segnala/i })).toHaveCount(0);
    await expect(page.getByText(/accedi per continuare/i)).toHaveCount(0);
    // Sezione lobby bloccata come per le pending.
    await expect(
      page.getByText(/le lobby si sbloccano quando il campo viene approvato/i)
    ).toBeVisible();

    tracker.assertClean();
  });
});
