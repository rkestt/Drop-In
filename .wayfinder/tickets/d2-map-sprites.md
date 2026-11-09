---
id: d2
type: bug
hitl: false
claimed: false
blocked_by: []
---
## Question

**Obiettivo.** La mappa deve mostrare cancelli e dissuasori (`gate`, `bollard`) senza dipendere da icone che lo stile Liberty non fornisce e senza errori di sprite in console.

**Contesto.** Lo stile `liberty` di OpenFreeMap dichiara 111 layer e uno sprite con 264 icone: **nessuna si chiama `gate` o `bollard`**, e non esiste un layer per `barrier_line`. La sorgente vettoriale `openmaptiles` dichiara `barrier_line` nello schema, ma i tile serviti da OpenFreeMap non la distribuiscono (TileJSON `maxzoom: 14`, layer assente nel pbf): le barriere arrivano solo come punti nel layer `poi`. Oggi quei dati non vengono disegnati: un campo dentro un parco con cancello chiuso sembra raggiungibile. Se un layer chiede `icon-image: "gate"`, MapLibre logga `Image "gate" not found`.

**File coinvolti.**

- `lib/map/icons.ts` (nuovo): SVG inline per `gate` e `bollard`, caricati con `HTMLImageElement` (non `map.loadImage`: non decodifica SVG in Chromium) e registrati con `map.addImage("gate" | "bollard", image, { pixelRatio: 2 })`.
- `components/map/court-map.tsx`: dopo `load`, registra le icone e aggiunge il layer gap-filler `dropin-barriers` su `source-layer: "poi"`.
- `tests/e2e/map-sprites.spec.ts` (nuovo).
- `docs/design/patterns/map.md`: sezione "Barriere".

**Regole.**

- **Riproduci prima.** Apri la mappa a zoom 16 su un parco con cancelli/dissuasori (es. Villa Borghese) e verifica che non compaiano; controlla la console per `Image "gate"` / `"bollard" not found`. Se il sintomo è diverso, annotalo nella Resolution e adatta il layer, non l'obiettivo.
- **Niente hex nel sorgente TS**: il colore si legge a runtime da `getComputedStyle(document.documentElement).getPropertyValue("--text-secondary")` (o `--border-strong`) e si compone nell'SVG. `lint:design` scansiona `lib/` e fallirebbe su un `#hex`; `components/map/court-map.tsx` è in allowlist ma `lib/map/icons.ts` no.
- Icone inline (data URI), nessun file binario, nessun nuovo host di rete: devono funzionare anche con il service worker offline.
- Se la registrazione fallisce, la mappa continua a funzionare: `console.warn` una volta, nessun crash, nessun retry infinito.
- Layer `dropin-barriers` come gap-filler su `source-layer: "poi"` (non `barrier_line`, assente nei tile): `source: "openmaptiles"`, `type: "symbol"`, `minzoom: 16`, nessun `maxzoom`, `filter` match sulle 5 classi barriera, `icon-image` match `gate`+`lift_gate` → gate e resto → bollard, `icon-size` 0.8, `icon-allow-overlap: true`, sotto le label, aggiunto dopo `hasImage`.

**Acceptance.**

Dopo il load `hasImage('gate'|'bollard')` è true e a z16 su Villa Borghese le barriere `poi` sono rese dal layer `dropin-barriers` (decine di icone, nessun warning sprite, nessun host nuovo).

**Comandi di verifica.**

```bash
npx playwright test tests/e2e/map-sprites.spec.ts
npm run lint:design
npx tsc --noEmit
# manuale: npm run dev, /?  → zoom su un parco (es. Villa Borghese), controllare icone e console
```

**Riferimenti.** `lib/map/provider.ts`, `docs/design/patterns/map.md`, `docs/research/map-tile-provider.md`.

## Issue GitHub collegate

Assorbite da questo ticket (dedup del Phase 1 review, PR #49):

- #56 `fix(map): sport change must not rebuild map / reset viewport` — il
  cambio sport non deve ricreare la mappa né perdere il viewport.
- #60 `fix(search): wire p_query RPC or downgrade roadmap claim; escape % and _`
  — ricerca campi: usare `p_query` o correggere la claim di roadmap, escape di
  `%`/`_`.
- #61 `fix(courts): consistent column exposure between courts_in_viewport and
  nearby_courts` — stesse colonne esposte dalle due RPC usate da mappa/browse.

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
- Decisione (b) dopo review: layer `dropin-barriers` su `barrier_line`
  RIMOSSO. Il layer rendeva 0 feature perché i tile OpenFreeMap non
  distribuiscono `barrier_line` (pbf, maxzoom 14); la forward-compat era
  illusoria (schema, nome proprietà, placement e nome del source-layer
  andrebbero comunque riverificati); i test fissavano un no-op
  (`toBeGreaterThanOrEqual(0)`, 0 garantito dal `minzoom`); l'effetto reale
  era già dato dalle icone sui layer POI.
- Gap reale a z16 (recon): 294/295 barriere di Villa Borghese hanno
  `rank ≥ 20`, quindi lo stile stock a z16 (`poi_r7`: rank 7–19) ne disegna
  1 sola; `poi_r20` parte da z17. Perciò `dropin-barriers` TORNA come
  gap-filler su `source-layer: "poi"`: filter match sulle 5 classi,
  icon-image match gate+lift_gate → gate e resto → bollard, minzoom 16
  senza maxzoom (a z17+ doppio disegno con `poi_r20`: stessa immagine e
  ancora; size 0.8 vs 1.0 stock e overlap nostro: a z17 le icone stock
  crescono e possono cullare, il nostro layer resta sotto — salto lieve
  accettato).

Classi servite dalle icone (`class` dal layer `poi`): `gate`,
`lift_gate` → `gate`; `bollard`, `cycle_barrier`, `block` → `bollard`.

Esito e2e (`tests/e2e/map-sprites.spec.ts`, 3/3 verdi):
- `hasImage("gate"|"bollard") === true` dopo il `load`; layer
  `dropin-barriers` su `openmaptiles`/`poi`, minzoom 16 senza maxzoom,
  filtro e icon-image verificati.
- Zoom 13 → 0 feature sul nostro layer.
- Villa Borghese z16 (centro sud-ovest, viewport 2560x1440): 91 barriere
  rese dal nostro layer contro 0 dei layer `poi_*` stock (misura il gap,
  non un `>= 0`); soglia assoluta `> 20` — dipende dai varchi mappati,
  il gate principale resta `ours > stock`; nessun warning gate/bollard
  dopo la registrazione.
- Nessun 404 di sprite; nessun host oltre `tiles.openfreemap.org`
  (+ localhost). Restano i warning pre-esistenti dei POI (`office`,
  `sports_centre`, `recycling`, `swimming_pool`) — mismatch stile/sprite
  fuori scope.
- Offline: dopo `setOffline(true)`, i data URI si decodificano via
  `Image` senza rete (test dedicato verde).

Nota tecnica per futuri ticket: `map.loadImage` (fetch +
`createImageBitmap`) NON decodifica gli SVG in Chromium
(`InvalidStateError: The source image could not be decoded`) — usare
`HTMLImageElement` + `addImage`.

`docs/design/patterns/map.md`: aggiunta sezione "Barriere" + token
`--border-strong`.

Issue collegate: #56 (cambio sport), #60 (`p_query`/escape), #61 (colonne `courts_in_viewport` vs `nearby_courts`) **non** sono state implementate da questa lane (scope: sprite + layer barriere). Restano aperte su GitHub: vanno chiuse con un lavoro dedicato, non dichiarate coperte.
