import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helper condivisi per la visual regression (`screens-visual.spec.ts`).
 *
 * - `freezeClock`: fissa `Date` alle 18:00 del 9 nov 2026 (Europe/Rome, vedi
 *   `timezoneId` nei progetti visual): orari relativi ("oggi", "12 min fa")
 *   e date diventano deterministici. Va chiamata PRIMA del `goto`.
 * - `waitForStablePage`: attende font locali, immagini e un segnale di
 *   prontezza specifico della schermata. Niente `waitForTimeout`.
 * - `seedOnboarded`: flag di primo avvio/coach PRIMA del `goto`, così la
 *   pagina non è `inert` sotto il drawer (vale su qualunque porta, mentre lo
 *   `storageState` committato vale solo per :3100).
 */

export const VISUAL_VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

export const VISUAL_CLOCK = new Date("2026-11-09T18:00:00+01:00");

/** Opzioni comuni a ogni scatto: pagina intera, diff massimo 1%. */
export const VISUAL_SHOT = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.01,
  fullPage: true,
} as const;

/** Elementi instabili mascherati in ogni scatto (no-op dove assenti). */
export function visualMask(page: Page) {
  return [page.locator("[data-visual-mask]")];
}

export async function seedOnboarded(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("dropin:onboarded:v1", "1");
    localStorage.setItem("dropin:coach:check-in", "1");
  });
}

export async function freezeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(VISUAL_CLOCK);
}

export async function assertLocalFonts(page: Page): Promise<void> {
  // I font sono locali (d3): se `next/font/local` non li applica il body
  // ricade sul system sans e le baseline sarebbero un falso verde.
  await page.evaluate(() => document.fonts.ready);
  const bodyFont = await page.evaluate(() =>
    getComputedStyle(document.body).fontFamily.toLowerCase(),
  );
  expect(bodyFont).toMatch(/source\s?sans/);
}

/**
 * Attende la stabilità di una schermata: segnale di prontezza della pagina
 * (heading o lista dati), poi font e immagini. Da chiamare dopo il `goto`.
 */
export async function waitForStablePage(
  page: Page,
  ready: Locator,
): Promise<void> {
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await assertLocalFonts(page);
  // `complete` è true anche in caso di errore: non si blocca mai sulle foto.
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), {
      timeout: 15_000,
    })
    .catch(() => undefined);
}
