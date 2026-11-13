import { test, expect } from "@playwright/test";

/**
 * #79 — warning MapLibre "Expected value to be of type number, but found
 * null instead." Lo stile upstream Liberty confronta `rank`/`ref_length`
 * senza guardia typeof; `lib/map/style-guards.ts` lo attenua a runtime via
 * `map.setFilter`. Questo test apre `/`, aspetta la mappa e fallisce se il
 * messaggio compare in console. Se tile/stile non sono raggiungibili (rete
 * assente, CI senza tile) lo skip e' pulito: niente rete = niente warning
 * possibile, ma il messaggio non viene mai ignorato quando la mappa gira.
 */
test("map console has no 'Expected value to be of type number' warning", async ({
  page,
}) => {
  const hits: string[] = [];
  let sawStyleJson = false;
  page.on("console", (msg) => {
    if (/Expected value to be of type number/.test(msg.text())) {
      hits.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("response", (res) => {
    if (/tiles\.openfreemap\.org\/styles\//.test(res.url()) && res.ok()) {
      sawStyleJson = true;
    }
  });

  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 15_000,
  });
  // Aspetta che lo stile sia caricato (o che sia chiaro che non arriva).
  await page
    .waitForFunction(() => !!window.__dropinMap?.isStyleLoaded?.(), {
      timeout: 30_000,
    })
    .catch(() => {});
  // Finestra di osservazione: i warning di Assertion scattano al render
  // dei tile vettoriali, non allo style load.
  await page.waitForTimeout(5_000);

  test.skip(!sawStyleJson, "stile Liberty non caricato (rete/tile non disponibili)");
  expect(hits).toEqual([]);
});
