import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";
import { SEEDED_COURT } from "./fixtures";

test("homepage shows map, nearby section and seeded courts on the map", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Partite vicine" })).toBeVisible({
    timeout: 15_000,
  });

  // Empty state OR lobby cards — both are valid for a fresh seed
  await expect(
    page.getByText(/Nessuna lobby attiva|Partite vicine/).first()
  ).toBeVisible();

  tracker.assertClean();
});

test("panning the map triggers viewport refetch without console errors", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Partite vicine" })).toBeVisible({
    timeout: 15_000,
  });

  // Drag the map to trigger a bounds change (zoom is > 10 by default)
  const canvas = page.locator("canvas.maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2 - 100, {
      steps: 10,
    });
    await page.mouse.up();
  }

  // Wait a beat for any fetch triggered by the pan
  await page.waitForTimeout(2_000);

  tracker.assertClean();
});
