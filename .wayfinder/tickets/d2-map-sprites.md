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

- `lib/map/icons.ts` (nuovo): SVG inline per `gate` e `bollard`, caricati con `HTMLImageElement` (non `map.loadImage`: non decodifica SVG in Chromium) e registrati con `map.addImage("gate" | "bollard", image, { pixelRatio: 2 })`.
- `components/map/court-map.tsx`: dopo `load`, registra le icone.
- `tests/e2e/map-sprites.spec.ts` (nuovo).
- `docs/design/patterns/map.md`: sezione "Barriere".

**Regole.**

- **Riproduci prima.** Apri la mappa a zoom 16 su un parco con cancelli/dissuasori (es. Villa Borghese) e verifica che non compaiano; controlla la console per `Image "gate"` / `"bollard" not found`. Se il sintomo è diverso, annotalo nella Resolution e adatta il layer, non l'obiettivo.
- **Niente hex nel sorgente TS**: il colore si legge a runtime da `getComputedStyle(document.documentElement).getPropertyValue("--text-secondary")` (o `--border-strong`) e si compone nell'SVG. `lint:design` scansiona `lib/` e fallirebbe su un `#hex`; `components/map/court-map.tsx` è in allowlist ma `lib/map/icons.ts` no.
- Icone inline (data URI), nessun file binario, nessun nuovo host di rete: devono funzionare anche con il service worker offline.
- Se la registrazione fallisce, la mappa continua a funzionare: `console.warn` una volta, nessun crash, nessun retry infinito.
- Niente layer proprio: i tile OpenFreeMap non distribuiscono `barrier_line`, quindi un layer dedicato sarebbe un no-op.

**Acceptance.**

Dopo il `load`, `hasImage("gate"|"bollard")` è true e a zoom 16 su Villa Borghese i POI con `class` barriera sono renderizzati dai layer POI dello stile senza warning `Image "gate"/"bollard"`; nessun host di rete nuovo, icone disponibili offline.

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
  Le icone inline servono i POI barriera, che e' il percorso visibile
  reale.
- Decisione (b) dopo review: layer `dropin-barriers` RIMOSSO. Il layer
  rende 0 feature perché i tile OpenFreeMap non distribuiscono
  `barrier_line` (pbf, maxzoom 14); la forward-compat è illusoria (schema,
  nome proprietà, placement e nome del source-layer andrebbero comunque
  riverificati); i test fissavano un no-op (`toBeGreaterThanOrEqual(0)`, 0
  garantito dal `minzoom`); l'effetto reale è già dato dalle icone sui
  layer POI (`poi`: 983 feature barriera a Villa Borghese, 12 renderizzate
  a z16, `class` distingue `gate`/`bollard`/`lift_gate`/`cycle_barrier`).

Classi servite dalle icone (`class` dal layer `poi`): `gate`,
`lift_gate` → `gate`; `bollard`, `cycle_barrier`, `block` → `bollard`.

Esito e2e (`tests/e2e/map-sprites.spec.ts`, 3/3 verdi):
- `hasImage("gate"|"bollard") === true` dopo il `load`; nessun layer
  proprio (scelta voluta, vedi sopra).
- Nessun nuovo warning gate/bollard dopo la registrazione; nessun 404 di
  sprite; nessun host oltre `tiles.openfreemap.org` (+ localhost). Restano
  i warning pre-esistenti dei POI (`office`, `sports_centre`, `recycling`,
  `swimming_pool`) — mismatch stile/sprite fuori scope.
- Offline: dopo `setOffline(true)`, i data URI si decodificano via
  `Image` senza rete (test dedicato verde).
- Villa Borghese z16: 983 feature barriera nei tile caricati
  (`querySourceFeatures` su `poi`), 12 renderizzate dai layer POI con le
  icone inline e nessun warning gate/bollard; screenshot
  `/tmp/opencode/borghese-z16.png` (mappa e POI regolari, nessun errore).

Nota tecnica per futuri ticket: `map.loadImage` (fetch +
`createImageBitmap`) NON decodifica gli SVG in Chromium
(`InvalidStateError: The source image could not be decoded`) — usare
`HTMLImageElement` + `addImage`.

`docs/design/patterns/map.md`: aggiunta sezione "Barriere" + token
`--border-strong`.
