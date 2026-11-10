import { expect, test } from "@playwright/test";

// d24: Supabase irraggiungibile → shell leggibile dalla cache, mai bianca.
// Simula il down di Supabase abortendo solo le sue REST/RPC (localhost app resta su).
test("supabase down: / mostra cache + stale badge", async ({ page }) => {
  // 1. Online: popola le cache (localStorage).
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Partite vicine" })).toBeVisible({
    timeout: 20000,
  });
  // La home imposta loading=false prima che la fetch finisca: attendi la cache.
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          window.localStorage.getItem("dropin:cache:lobbies:v1"),
        ),
      { timeout: 20000 },
    )
    .not.toBeNull();

  // 2. Supabase down.
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/**", (route) => route.abort());

  // / con cache: resta leggibile + stale badge.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Partite vicine" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText(/Dati di /).first()).toBeVisible({ timeout: 10000 });

  // Nota: /courts/<id> è server-side, l'abort browser non la tocca:
  // la shell offline si verifica con Supabase davvero spento (vedi spec
  // docs/design/specs/offline.md § verifica manuale).
});
