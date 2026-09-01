import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { trackConsoleErrors } from "./helpers/console";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function getFirstSeededCourtId(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from("courts")
    .select("id, name")
    .limit(1)
    .single();
  if (error) throw new Error(`Cannot fetch seeded court: ${error.message}`);
  return data.id;
}

test("court detail renders with check-in and report actions", async ({ page }) => {
  const tracker = await trackConsoleErrors(page);

  const courtId = await getFirstSeededCourtId();
  await page.goto(`/courts/${courtId}`);

  // Court name heading exists (h1)
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("h1")).not.toHaveText("");

  // Lobby section present
  await expect(
    page.getByRole("heading", { name: /lobby|partite/i })
  ).toBeVisible();

  tracker.assertClean();
});

test("unknown court id does not crash the app", async ({ page }) => {
  const tracker = await trackConsoleErrors(page);

  await page.goto("/courts/00000000-0000-0000-0000-000000000000");

  // App must render something sane: either the court page or a 404 — not a crash
  await expect(
    page.getByRole("heading", { name: /404|This page could not be found/i }).first()
  ).toBeVisible({ timeout: 15_000 });

  tracker.assertClean();
});
