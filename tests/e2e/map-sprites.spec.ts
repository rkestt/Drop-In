import { test, expect } from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
// Unico host remoto consentito per la mappa.
const ALLOWED_REMOTE_HOSTS = new Set(["tiles.openfreemap.org"]);

test("barrier icons register and dropin-barriers layer is configured", async ({
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

  // Layer gap-filler su poi: sorgente, minzoom, filtro per classe e
  // icon-image con le due icone inline.
  const layer = await page.evaluate(() => {
    const map = window.__dropinMap;
    if (!map) throw new Error("__dropinMap not set");
    const spec = map.getLayer("dropin-barriers") as unknown as Record<string, unknown>;
    return {
      type: spec["type"],
      source: spec["source"],
      sourceLayer: spec["sourceLayer"],
      minzoom: spec["minzoom"],
      maxzoom: spec["maxzoom"],
      filter: map.getFilter("dropin-barriers"),
      iconImage: map.getLayoutProperty("dropin-barriers", "icon-image"),
      iconSize: map.getLayoutProperty("dropin-barriers", "icon-size"),
      iconAllowOverlap: map.getLayoutProperty("dropin-barriers", "icon-allow-overlap"),
    };
  });
  expect(layer.type).toBe("symbol");
  expect(layer.source).toBe("openmaptiles");
  expect(layer.sourceLayer).toBe("poi");
  expect(layer.minzoom).toBe(16);
  expect(layer.maxzoom).toBeUndefined();
  const flatFilter = JSON.stringify(layer.filter);
  expect((layer.filter as unknown[])?.[0]).toBe("match");
  for (const cls of ["gate", "lift_gate", "bollard", "cycle_barrier", "block"]) {
    expect(flatFilter).toContain(cls);
  }
  const iconImage = layer.iconImage as unknown[];
  expect(iconImage[0]).toBe("match");
  expect(JSON.stringify(iconImage)).toContain("gate");
  expect(layer.iconSize).toBe(0.8);
  expect(layer.iconAllowOverlap).toBe(true);

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
  // Viewport ampia: a z16 il conteggio delle icone rese dipende
  // dall'area inquadrata; con 2560x1440 su Villa Borghese il layer ne
  // rende decine.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
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

  // Parco con cancelli/dissuasori mappati in OSM (lato sud-ovest, zona
  // con piu' varchi).
  const VILLA_BORGHESE: [number, number] = [12.479, 41.912];
  await page.evaluate((center: [number, number]) => {
    window.__dropinMap?.easeTo({
      center,
      zoom: 16,
      duration: 0,
    });
  }, VILLA_BORGHESE);

  // Le classi barriera sono nel layer poi: poll finche' i tile non sono
  // caricati. Misura il gap: il nostro layer deve rendere barriere in
  // numero nettamente superiore ai layer poi_* stock (a z16 mostrano solo
  // rank 7-19, mentre quasi tutte le barriere di Villa Borghese hanno
  // rank >= 20). Il gate principale e' ours > stock; la soglia assoluta
  // dipende dai varchi mappati a Villa Borghese (osservato 91 a 2560x1440).
  //
  // Budget largo (90s): sotto carico il dev server compila a comando, i
  // tile OpenFreeMap arrivano dopo la compilazione e un context-restore
  // (GPU sotto pressione) ricrea la mappa ripartendo da zero. Il poll
  // ritorna lo stato intero in un solo evaluate: un fallimento stampa
  // quale condizione mancava (layer? tile? conteggi?) invece di "0 per 30s"
  // — queryRenderedFeatures su layer inesistente ritorna [] senza lanciare.
  const BARRIER_CLASSES = ["gate", "bollard", "lift_gate", "cycle_barrier", "block"];
  const readBarrierState = () =>
    page.evaluate(
      (args: { center: [number, number]; classes: string[] }) => {
            const map = window.__dropinMap;
            if (!map) {
              return {
                layer: false,
                tilesLoaded: false,
                ours: 0,
                stock: 0,
                ready: false,
              };
            }
            // La mappa puo' essere stata ricreata sotto i piedi del test:
            // su webglcontextrestored court-map.tsx ricrea a Roma z14 senza
            // riapplicare l'easeTo, e con minzoom 16 il layer renderebbe 0
            // per sempre. Riapplica la vista del test e riprova al giro dopo.
            const c = map.getCenter();
            if (
              map.getZoom() < 16 ||
              Math.abs(c.lng - args.center[0]) > 0.01 ||
              Math.abs(c.lat - args.center[1]) > 0.01
            ) {
              map.easeTo({ center: args.center, zoom: 16, duration: 0 });
              return {
                layer: !!map.getLayer("dropin-barriers"),
                tilesLoaded: false,
                ours: 0,
                stock: 0,
                ready: false,
              };
            }
            const layer = !!map.getLayer("dropin-barriers");
            // areTilesLoaded e' vero anche con tile in errore: vale solo
            // combinato ai conteggi, mai da solo.
            const tilesLoaded = map.areTilesLoaded();
            const ours = map.queryRenderedFeatures({
              layers: ["dropin-barriers"],
            }).length;
            const poiLayers = ["poi_r20", "poi_r7", "poi_r1", "poi_transit"].filter(
              (l) => !!map.getLayer(l),
            );
            const stock = map
              .queryRenderedFeatures({ layers: poiLayers })
              .filter((f) =>
                args.classes.includes(
                  (f.properties as Record<string, unknown> | null)?.class as string,
                ),
              ).length;
            return {
              layer,
              tilesLoaded,
              ours,
              stock,
              ready: layer && tilesLoaded && ours > 20 && ours > stock,
            };
          },
          { center: VILLA_BORGHESE, classes: BARRIER_CLASSES },
        );
  await expect
    .poll(() => readBarrierState(), { timeout: 90_000 })
    .toMatchObject({ layer: true, ready: true });
  // Rilettura dopo il via: i conteggi finali per log e asserzioni.
  const state = await readBarrierState();
  console.log(`dropin-barriers at z16 Villa Borghese: ours=${state.ours} stock=${state.stock}`);
  // Layer assente e layer che non rende sono due rossi diversi: il primo
  // muore qui, il secondo sui conteggi sotto.
  expect(state.layer).toBe(true);
  // dipende dai varchi mappati a Villa Borghese; osservato 91 a 2560x1440
  expect(state.ours).toBeGreaterThan(20);
  expect(state.ours).toBeGreaterThan(state.stock);
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
  // Budget unico e generoso (60s, test 90s): al primo hit sotto carico il
  // dev server compila a comando (migliaia di moduli) e tile + setup icone
  // aspettano la compilazione. Stato letto con un solo evaluate: un
  // fallimento stampa quale condizione mancava (canvas? uris? map? quale
  // icona?) invece di un timeout muto.
  test.setTimeout(90_000);
  await page.goto("/");
  // Stato letto con un solo evaluate: un
  // fallimento stampa quale condizione mancava (canvas? uris? map? quale
  // icona?) invece di un timeout muto.
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          canvas: !!document.querySelector("canvas.maplibregl-canvas"),
          uris: !!window.__dropinBarrierIconUris,
          map: !!window.__dropinMap,
          gate: !!window.__dropinMap?.hasImage("gate"),
          bollard: !!window.__dropinMap?.hasImage("bollard"),
        })),
      { timeout: 60_000 },
    )
    .toMatchObject({
      canvas: true,
      uris: true,
      map: true,
      gate: true,
      bollard: true,
    });

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
