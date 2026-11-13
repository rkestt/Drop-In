# Mappa: stile upstream, warning #79, coordinate

`components/map/court-map.tsx` monta MapLibre GL sullo stile vettoriale
OpenFreeMap Liberty (`lib/map/provider.ts`). Dettagli provider/cache in
`docs/research/map-tile-provider.md`; qui solo le due trappole runtime.

## Warning "Expected value to be of type number, but found null instead" (#79)

**Causa: lo stile upstream, non il nostro codice.** La stringa esiste solo
in `Assertion.evaluate` di maplibre-gl e le assertion vengono iniettate
solo per confronti d'ordine con operando sinistro non tipizzato. Nel
nostro layer `dropin-barriers` (`court-map.tsx`) non ce ne sono (solo
`match` su stringhe/booleani e `icon-size` letterale): il warning viene
dai layer Liberty che confrontano proprieta' che non tutte le feature
hanno (manca la proprieta' → `["get", …]` valuta null):

- `poi_r20`: `["all", ["match", ["geometry-type"], …], [">=", ["get", "rank"], 20]]`
- `poi_r7` / `poi_r1`: stessa forma (`>= 7, < 20` / `>= 1, < 7`)
- `highway-shield-*` / `road_shield_us`: `["<=", ["get", "ref_length"], 6]`
- `label_country_3`: `[">=", ["get", "rank"], 3]`
- (`boundary_3` ha gia' la guardia typeof a monte, non warnna)

**Fix: guardia runtime in `lib/map/style-guards.ts`.** `guardFilter`
avvolge ogni confronto d'ordine su `["get", prop]` in
`["all", ["!=", ["typeof", ["get", prop]], "null"], <originale>]`;
`guardStyleLayersFilter` lo applica ai layer e ritorna solo quelli
cambiati. `court-map.tsx` lo chiama su `load` e `style.load`
(sopravvive a `setStyle`), mai prima che lo stile esista, con try/catch
best-effort. Idempotente: il secondo passaggio non cambia nulla.

**Rischio residuo:** se upstream cambia i filtri (nuove prop non
tipizzate, guardia rimossa) il warning puo' tornare o la guardia puo'
diventare superflua — `tests/e2e/map-console.spec.ts` lo segnala.

## Coordinate non finite

`setLngLat` con NaN/null piazza marker fantasma. Difesa su due livelli:

1. `hasFiniteCourtCoords` (`lib/courts/search.ts`): filtra le liste dove
   nascono — browse `courts_in_viewport`, ricerca `nearby_courts`,
   fallback cache offline in lettura (`app/(app)/page.tsx`).
2. `court-map.tsx` salta comunque i court non finiti prima di
   `setLngLat` (e la `userLocation` non finita prima di `flyTo`).

## Attribuzione

L'attribuzione la fornisce lo stile Liberty (per OpenFreeMap) o la `source`
raster (per OSM). Non va passata anche in `attributionControl.customAttribution`:
prima era un oggetto (quindi scartato) e, una volta corretta la stringa,
compariva due volte. Il controllo resta `compact: false`.
