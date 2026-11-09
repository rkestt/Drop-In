import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";

// Migrazione Sonner (d6): dalla styleguide si genera un esito,
// il toast è unico, in alto al centro, e lo swipe verso l'alto lo chiude.

test("styleguide toast: un solo nodo, top-center a 16px, swipe up lo chiude", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);

  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Mostra toast" }).click();

  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toHaveCount(1);

  // Attende la fine dell'animazione di ingresso (da translateY(±100%) a 0):
  // la misura ha senso solo a toast assestato.
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-sonner-toast]");
    if (!el) return false;
    const y = el.getBoundingClientRect().y;
    return y >= 14 && y <= 18;
  });

  // Posizione: 16px dal top (safe-area 0 su desktop), centrato orizzontalmente.
  const box = await toast.first().boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.y - 16)).toBeLessThanOrEqual(2);
  const viewport = page.viewportSize()!;
  const centerX = box!.x + box!.width / 2;
  expect(Math.abs(centerX - viewport.width / 2)).toBeLessThanOrEqual(8);

  // Swipe verso l'alto: trascina il toast oltre la soglia e rilascialo.
  const startX = centerX;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 160, { steps: 12 });
  await page.mouse.up();

  await expect(toast).toHaveCount(0);

  tracker.assertClean();
});

test("toast con reduced motion: appare leggibile senza animazione", async ({
  page,
}) => {
  const tracker = await trackConsoleErrors(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "Mostra toast" }).click();

  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toHaveCount(1);
  await expect(toast.first()).toContainText("Campo aggiunto");

  const transitionDuration = await toast.first().evaluate(
    (el) => getComputedStyle(el).transitionDuration
  );
  // Regola globale anti-motion (o media query Sonner): durata ~0.
  const durations = transitionDuration.split(",").map((d) => parseFloat(d));
  for (const d of durations) {
    expect(d).toBeLessThanOrEqual(0.02);
  }

  tracker.assertClean();
});
