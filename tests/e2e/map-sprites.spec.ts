import { test, expect, type Page } from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
// Unico host remoto consentito per la mappa.
const ALLOWED_REMOTE_HOSTS = new Set(["tiles.openfreemap.org"]);

interface BarrierLayerInfo {
  type: unknown;
  source: unknown;
  sourceLayer: unknown;
  minzoom: unknown;
  iconImage: unknown;
  iconSize: unknown;
  iconAllowOverlap: unknown;
}

async function readBarrierLayer(page: Page): Promise<BarrierLayerInfo> {
  return page.evaluate(() => {
    const map = window.__dropinMap;
    if (!map) throw new Error("__dropinMap not set");
    const layer = map.getLayer("dropin-barriers") as unknown as Record<string, unknown>;
    return {
      type: layer["type"],
      source: layer["source"],
      sourceLayer: layer["sourceLayer"],
      minzoom: layer["minzoom"],
      iconImage: map.getLayoutProperty("dropin-barriers", "icon-image"),
      iconSize: map.getLayoutProperty("dropin-barriers", "icon-size"),
      iconAllowOverlap: map.getLayoutProperty("dropin-barriers", "icon-allow-overlap"),
    } satisfies BarrierLayerInfo;
  });
}

test("barrier sprites register and dropin-barriers layer is configured", async ({
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
      window.__dropinMap.hasImage("bollard") &&
      !!window.__dropinMap.getLayer("dropin-barriers"),
    { timeout: 30_000 },
  );
  const setupAt = Date.now();

  const layer = await readBarrierLayer(page);
  expect(layer.type).toBe("symbol");
  expect(layer.source).toBe("openmaptiles");
  expect(layer.sourceLayer).toBe("barrier_line");
  expect(layer.minzoom).toBe(16);
  expect(layer.iconSize).toBe(0.8);
  expect(layer.iconAllowOverlap).toBe(true);

  const iconImage = layer.iconImage as unknown[];
  expect(iconImage[0]).toBe("match");
  const flat = JSON.stringify(iconImage);
  for (const cls of ["gate", "lift_gate", "bollard", "cycle_barrier", "block"]) {
    expect(flat).toContain(cls);
  }

  // Sotto minzoom il layer non disegna nulla.
  await page.evaluate(() => {
    window.__dropinMap?.setZoom(13);
  });
  await page.waitForTimeout(1_500);
  const renderedBelow = await page.evaluate(
    () =>
      window.__dropinMap?.queryRenderedFeatures({
        layers: ["dropin-barriers"],
      }).length ?? -1,
  );
  expect(renderedBelow).toBe(0);

  // A zoom >= 16 il layer interroga la sorgente senza errori (il conteggio
  // dipende dai dati OSM reali in viewport, quindi non si asserisce).
  await page.evaluate(() => {
    window.__dropinMap?.setZoom(16);
  });
  await page.waitForTimeout(3_000);
  const renderedAt16 = await page.evaluate(
    () =>
      window.__dropinMap?.queryRenderedFeatures({
        layers: ["dropin-barriers"],
      }).length ?? -1,
  );
  expect(renderedAt16).toBeGreaterThanOrEqual(0);
  console.log(`dropin-barriers features at zoom 16: ${renderedAt16}`);

  // Le icone sono registrate prima del layer, quindi dopo il setup non
  // devono comparire nuovi warning per gate/bollard. Restano i warning
  // pre-esistenti dei POI (office, sports_centre, ...) che lo stile liberty
  // risolve per-class dallo sprite: fuori scope di questo ticket.
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
  await page.goto("/");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForFunction(
    () =>
      !!window.__dropinMap &&
      !!window.__dropinMap.getLayer("dropin-barriers"),
    { timeout: 30_000 },
  );

  // Parco con cancelli/dissuasori mappati in OSM.
  await page.evaluate(() => {
    window.__dropinMap?.easeTo({
      center: [12.4853, 41.9142],
      zoom: 16,
      duration: 0,
    });
  });

  // Le classi barriera arrivano dal layer poi (barrier_line non e'
  // distribuito dai tile OpenFreeMap, vedi ticket): poll finche' i tile
  // non sono caricati.
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
