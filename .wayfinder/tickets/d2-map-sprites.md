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

(TBD — chiudere con: classi mappate, screenshot a zoom 16, esito offline, eventuale nota su `patterns/map.md`; esito di #56, #60, #61 con i test che li coprono.)
