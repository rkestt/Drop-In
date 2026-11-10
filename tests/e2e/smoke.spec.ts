import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";

test("homepage loads with map and lobby section, zero console errors", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);

  await page.goto("/");

  // Loading state resolves
  await expect(page.getByRole("heading", { name: "Partite vicine" })).toBeVisible({
    timeout: 15_000,
  });

  // MapLibre canvas rendered
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();

  // Auth entry point present for anonymous users
  await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();

  // d26: login lazy — il click apre il dialog (chunk async), mai click morto:
  // o il fallback di caricamento o direttamente il form, poi il form.
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(
    page
      .getByLabel(/indirizzo email/i)
      .or(page.getByRole("status", { name: /caricamento accesso/i })),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/indirizzo email/i)).toBeVisible({
    timeout: 15_000,
  });

  tracker.assertClean();
});
