---
id: d2
type: bug
hitl: false
claimed: false
blocked_by: []
---
## Question

**Obiettivo.** La mappa deve mostrare cancelli e dissuasori (`gate`, `bollard`) senza dipendere da icone che lo stile Liberty non fornisce e senza errori di sprite in console.

**Contesto.** Lo stile `liberty` di OpenFreeMap dichiara 111 layer e uno sprite con 264 icone: **nessuna si chiama `gate` o `bollard`**, e non esiste un layer per `barrier_line`. La sorgente vettoriale `openmaptiles` però espone `barrier_line` con classi tipo `gate`, `bollard`, `lift_gate`, `cycle_barrier`, `block`. Oggi quei dati non vengono disegnati: un campo dentro un parco con cancello chiuso sembra raggiungibile. Se in futuro un layer chiede `icon-image: "gate"`, MapLibre logga `Image "gate" not found`.

**File coinvolti.**

- `lib/map/icons.ts` (nuovo): SVG inline per `gate` e `bollard`, rasterizzati con `map.loadImage(dataUri)` e registrati con `map.addImage("gate" | "bollard", image, { pixelRatio: 2 })`.
- `components/map/court-map.tsx`: dopo `load`, registra le icone e aggiunge il layer `dropin-barriers`.
- `tests/e2e/map-sprites.spec.ts` (nuovo).
- `docs/design/patterns/map.md`: sezione "Barriere".

**Regole.**

- **Riproduci prima.** Apri la mappa a zoom 16 su un parco con cancelli/dissuasori (es. Villa Borghese) e verifica che non compaiano; controlla la console per `Image "gate"` / `"bollard" not found`. Se il sintomo è diverso, annotalo nella Resolution e adatta il layer, non l'obiettivo.
- **Niente hex nel sorgente TS**: il colore si legge a runtime da `getComputedStyle(document.documentElement).getPropertyValue("--text-secondary")` (o `--border-strong`) e si compone nell'SVG. `lint:design` scansiona `lib/` e fallirebbe su un `#hex`; `components/map/court-map.tsx` è in allowlist ma `lib/map/icons.ts` no.
- Icone inline (data URI), nessun file binario, nessun nuovo host di rete: devono funzionare anche con il service worker offline.
- Layer `dropin-barriers`: `source: "openmaptiles"`, `source-layer: "barrier_line"`, `type: "symbol"`, `minzoom: 16`, `icon-size` 0.8, `icon-allow-overlap: true`. Mappa le classi con un'espressione `match`: `gate` e `lift_gate` → `gate`; `bollard`, `cycle_barrier`, `block` → `bollard`; default → `bollard`.
- Il layer sta **sotto** i marker dei campi e non intercetta i tap (`icon-ignore-placement` non serve; i marker sono DOM, restano sopra).
- Se `loadImage` fallisce, la mappa continua a funzionare: `console.warn` una volta, nessun crash, nessun retry infinito.

**Acceptance.**

- Dopo il `load`, `map.hasImage("gate") === true` e `map.hasImage("bollard") === true`.
- `map.getLayer("dropin-barriers")` esiste e ha i parametri sopra.
- A zoom ≥ 16 su un parco con barriere le icone sono visibili; a zoom < 16 il layer non appare.
- Console pulita: nessun `Image "..." not found`, nessun 404 di sprite, nessuna richiesta a host diversi da `tiles.openfreemap.org`.
- Con DevTools offline dopo la prima visita, le icone continuano a comparire (sono inline).
- `npx playwright test tests/e2e/map-sprites.spec.ts` verde; `npm run lint:design` verde; `npx tsc --noEmit` verde.

**Comandi di verifica.**

```bash
npx playwright test tests/e2e/map-sprites.spec.ts
npm run lint:design
npx tsc --noEmit
# manuale: npm run dev, /?  → zoom su un parco (es. Villa Borghese), controllare icone e console
```

**Riferimenti.** `lib/map/provider.ts`, `docs/design/patterns/map.md`, `docs/research/map-tile-provider.md`.

## Resolution

Riproduzione (2026-11-09, verifica statica + browser):
- Stile liberty: 111 layer, nessuno su `barrier_line`; sprite
  `ofm_f384` da 264 icone, nessuna `gate`/`bollard`. Nel codice non
  esistevano `addImage`/`loadImage`/`hasImage` ne' alcun layer barriere.
- Sintomo diverso da quello ipotizzato: i warning `Image "gate" /
  "bollard" could not be loaded` esistevano GIA' al primo load, emessi dai
  layer POI dello stile (`poi_r20/r7/r1`, `poi_transit` usano `icon-image`
  data-driven da `class`/`subclass`) — non da un layer futuro. Il tile z14
  su Roma contiene classi POI `gate`, `bollard`, `lift_gate`,
  `cycle_barrier` (verificato parsando il pbf).
- Scoperta adattata (layer non cambiato d'obiettivo): i tile OpenFreeMap
  (`planet`, TileJSON `maxzoom: 14`) NON distribuiscono `barrier_line`
  (layer presenti: aeroway, boundary, building, housenumber, landcover,
  landuse, park, place, poi, transportation(+_name), water(+_name)).
  Quindi `dropin-barriers` e' configurato correttamente ma rende 0 feature
  finche' la sorgente non espone il layer; le icone inline servono gia' i
  POI barriera, che e' il percorso visibile reale.

Classi mappate (match su `class`): `gate`, `lift_gate` → `gate`;
`bollard`, `cycle_barrier`, `block` → `bollard`; default → `bollard`.

Esito e2e (`tests/e2e/map-sprites.spec.ts`, 3/3 verdi):
- `hasImage("gate"|"bollard") === true`, layer `dropin-barriers` con
  source `openmaptiles`, source-layer `barrier_line`, minzoom 16,
  icon-size 0.8, overlap, match con le 5 classi.
- Zoom 13 → 0 feature renderizzate; zoom 16 → query senza errori.
- Nessun nuovo warning gate/bollard dopo il setup; nessun 404 di sprite;
  nessun host oltre `tiles.openfreemap.org` (+ localhost). Restano i
  warning pre-esistenti dei POI (`office`, `sports_centre`, `recycling`,
  `swimming_pool`) — mismatch stile/sprite fuori scope.
- Offline: dopo `setOffline(true)`, i data URI si decodificano via
  `Image` senza rete (test dedicato verde).
- Villa Borghese z16: 983 feature barriera nei tile caricati
  (`querySourceFeatures` su `poi`), 12 renderizzate dai layer POI con le
  icone inline; screenshot `/tmp/opencode/borghese-z16.png` (mappa e POI
  regolari, nessun errore).

Nota tecnica per futuri ticket: `map.loadImage` (fetch +
`createImageBitmap`) NON decodifica gli SVG in Chromium
(`InvalidStateError: The source image could not be decoded`) — usare
`HTMLImageElement` + `addImage`. E registrare le icone PRIMA di
`addLayer`, altrimenti il renderer logga warning una tantum per id.

`docs/design/patterns/map.md`: aggiunta sezione "Barriere" + token
`--border-strong`.
