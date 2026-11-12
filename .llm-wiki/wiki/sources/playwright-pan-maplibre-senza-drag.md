---
type: source
title: "Playwright: testare il pan di una mappa MapLibre senza drag"
slug: playwright-pan-maplibre-senza-drag
status: insight
category: "source"
created: 2026-11-12
updated: 2026-11-12
---

# Playwright: testare il pan di una mappa MapLibre senza drag

# Playwright: testare il pan di una mappa MapLibre senza drag

## Problema
Un test headless che simula il drag con `page.mouse` su una mappa MapLibre **non** produce `moveend`: la mappa non si muove, quindi il ramo "bounds cambiati" non viene mai eseguito. Un tester automatico conclude "non verificabile" e un bug lì dentro passa liscio.

## Soluzione
Se il componente espone già la mappa per i test (qui `window.__dropinMap`, vedi `components/map/court-map.tsx`), guidarla direttamente:

```ts
await page.waitForFunction(() => !!window.__dropinMap);
const moved = page.waitForRequest((r) => r.url().includes("nearby_courts"));
await page.evaluate(() => {
  const map = window.__dropinMap!;
  const c = map.getCenter();
  map.jumpTo({ center: [c.lng + 0.15, c.lat], zoom: 12 });
});
const body = JSON.parse((await moved).postData() ?? "{}");
expect(body.p_query).toBe("parco");
expect(body.p_lng).toBeGreaterThan(firstLng + 0.01);
```

Punti che fanno la differenza:
- `jumpTo`/`flyTo` **scatenano** `moveend` in modo affidabile; il drag del puntatore no.
- Aspettare la **request** (con body) invece di un cambio DOM: `waitForRequest` + `postData()` dimostra che il nuovo centro è stato propagato all'RPC, non solo che la UI ha ridisegnato.
- Asserire che il contatore non torni allo stato di caricamento: così si becca il flash di skeleton che un check "lista visibile" non vede.

## Dove sta
`tests/e2e/search.spec.ts` (gate `E2E_WITH_DB=1`), caso "spostare la mappa con query attiva rifà la ricerca sul nuovo centro".

## Related
- `tests/e2e/map-sprites.spec.ts` (stesso handle, per layer e sprite)
- `docs/roadmap.md` (issue #68)
