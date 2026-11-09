import { test, expect } from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
// Unico host remoto consentito per la mappa.
const ALLOWED_REMOTE_HOSTS = new Set(["tiles.openfreemap.org"]);

test("barrier icons register with no new gate/bollard warnings", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const timedWarnings: Array<{ at: number; text: string }> = [];
  const unexpectedHosts = new Set<string>();
  const failedSprites: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    else if (msg.type() === "warning" && /Image "/.test(msg.text())) {
      timedWarnings.push({ at: Date.now(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (
      url.protocol.startsWith("http") &&
      !LOCAL_HOSTS.has(url.hostname) &&
      !ALLOWED_REMOTE_HOSTS.has(url.hostname)
    ) {
      unexpectedHosts.add(url.hostname);
    }
    if (res.status() >= 400 && /sprite/i.test(res.url())) {
      failedSprites.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(
    () =>
      !!window.__dropinMap &&
      window.__dropinMap.hasImage("gate") &&
      window.__dropinMap.hasImage("bollard"),
    { timeout: 30_000 },
  );
  const setupAt = Date.now();

  // Dopo la registrazione non devono comparire nuovi warning per
  // gate/bollard (le icone inline risolvono i lookup dei POI). Restano i
  // warning pre-esistenti dei POI (office, sports_centre, ...) che lo stile
  // liberty risolve per-class dallo sprite: fuori scope di questo ticket.
  const lateBarrierWarnings = timedWarnings.filter(
    (w) =>
      w.at > setupAt &&
      (w.text.includes('Image "gate"') || w.text.includes('Image "bollard"')),
  );
  expect(lateBarrierWarnings).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedSprites).toEqual([]);
  expect([...unexpectedHosts]).toEqual([]);
});

test("barrier-class POIs are visible at zoom 16 in Villa Borghese", async ({
  page,
}) => {
  const timedWarnings: Array<{ at: number; text: string }> = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" && /Image "/.test(msg.text())) {
      timedWarnings.push({ at: Date.now(), text: msg.text() });
    }
  });
  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForFunction(
    () =>
      !!window.__dropinMap &&
      window.__dropinMap.hasImage("gate") &&
      window.__dropinMap.hasImage("bollard"),
    { timeout: 30_000 },
  );
  const setupAt = Date.now();

  // Parco con cancelli/dissuasori mappati in OSM.
  await page.evaluate(() => {
    window.__dropinMap?.easeTo({
      center: [12.4853, 41.9142],
      zoom: 16,
      duration: 0,
    });
  });

  // Le classi barriera arrivano dal layer poi (i tile OpenFreeMap non
  // distribuiscono barrier_line, vedi ticket): poll finche' i tile non
  // sono caricati.
  let hit = 0;
  let rendered = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2_500);
    const counts = await page.evaluate(() => {
      const map = window.__dropinMap;
      if (!map) return { hit: 0, rendered: 0 };
      const feats = map.querySourceFeatures("openmaptiles", {
        sourceLayer: "poi",
      });
      const hitCount = feats.filter((f) =>
        ["gate", "bollard", "lift_gate", "cycle_barrier", "block"].includes(
          (f.properties as Record<string, unknown> | null)?.class as string,
        ),
      ).length;
      const layers = ["poi_r20", "poi_r7", "poi_r1", "poi_transit"].filter(
        (l) => !!map.getLayer(l),
      );
      return {
        hit: hitCount,
        rendered: map.queryRenderedFeatures({ layers }).length,
      };
    });
    hit = counts.hit;
    rendered = counts.rendered;
    if (hit > 0 && rendered > 0) break;
  }
  expect(hit).toBeGreaterThan(0);
  expect(rendered).toBeGreaterThan(0);
  // I POI barriera sono renderizzati dallo stile con le icone inline:
  // nessun warning gate/bollard dopo la registrazione.
  const lateBarrierWarnings = timedWarnings.filter(
    (w) =>
      w.at > setupAt &&
      (w.text.includes('Image "gate"') || w.text.includes('Image "bollard"')),
  );
  expect(lateBarrierWarnings).toEqual([]);
});

test("barrier icons load with zero network (inline data URIs)", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForFunction(
    () =>
      !!window.__dropinBarrierIconUris &&
      !!window.__dropinMap?.hasImage("gate") &&
      !!window.__dropinMap?.hasImage("bollard"),
    { timeout: 30_000 },
  );

  // Da qui in poi niente rete: le icone inline devono caricarsi comunque.
  await context.setOffline(true);
  try {
    const loaded = await page.evaluate(async () => {
      const uris = window.__dropinBarrierIconUris;
      if (!uris) throw new Error("barrier hooks not set");
      for (const uri of [uris.gate, uris.bollard]) {
        if (!uri.startsWith("data:image/svg+xml")) return false;
        // Stesso percorso di lib/map/icons.ts (Image, non loadImage:
        // createImageBitmap non decodifica SVG in Chromium).
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth === 24);
          img.onerror = () => resolve(false);
          img.src = uri;
        });
        if (!ok) return false;
      }
      return true;
    });
    expect(loaded).toBe(true);
  } finally {
    await context.setOffline(false);
  }
});
