# Pattern: mappa

## Stile

- Provider: **OpenFreeMap**.
- Stile: **liberty** (sempre chiaro).
- La mappa non cambia tema con l’app: anche il futuro dark mode avrà mappa chiara.

## Marker

- Colore di default: da allineare a `--accent` per coerenza.
- Stato selezionato: ingrandimento + ombra.
- Stato segnalato: colore `--danger` o badge apposito.

## UI sovrapposta

| Elemento | Posizione | z-index |
|---|---|---|
| Sport selector | top-3 left-3 | 20 |
| Banner “nessun campo” | bottom-4 left-1/2 -translate-x-1/2 | 20 |
| FAB “Aggiungi campo” | bottom-4 right-4 | 30 |

## Attribution

- Non nascondere l’attribution di MapLibre/OpenStreetMap.
- Mantenerla leggibile sullo stile chiaro.

## Interazione

- Zoom minimo per fetch: 10 (`zoom < 10` non carica campi).
- Drag/pinch nativi di MapLibre.
- Tap su marker apre dettaglio o navigazione.

## Stati

| Stato | Comportamento |
|---|---|
| Caricamento | `MapSkeleton` con `dynamic` import. |
| Errore geolocalizzazione | Fallback su centro di Roma, messaggio discreto. |
| Nessun campo | Banner inline sulla mappa. |

## Barriere

- Lo stile liberty non fornisce sprite `gate`/`bollard` (sprite da 264
  icone, nessun match).
- I layer POI dello stile (`poi_r20/r7/r1`, `poi_transit`) risolvono
  `icon-image` per classe: le classi `gate`, `bollard`, `lift_gate`,
  `cycle_barrier` arrivano dal layer `poi` e senza sprite dedicati
  MapLibre logga `Image "gate" could not be loaded`.
- Icone inline in `lib/map/icons.ts`: SVG data URI, colore letto a runtime
  da `--text-secondary` (fallback `--border-strong`), mai hex nel sorgente
  (lo impone `lint:design`). Registrate con `addImage` + `pixelRatio: 2`
  dopo il `load`; se la registrazione fallisce: un solo `console.warn`,
  nessun retry infinito.
- Niente layer proprio: i tile OpenFreeMap non distribuiscono
  `barrier_line` (pbf verificato, TileJSON `maxzoom: 14`), quindi sarebbe
  un no-op; se un provider futuro esporrà barriere su un altro
  `source-layer`, ticket dedicato con verifica sul pbf reale.
- Nota tecnica: `map.loadImage` non decodifica gli SVG in Chromium
  (`createImageBitmap` → `InvalidStateError`), quindi le icone si caricano
  con `HTMLImageElement` + `addImage`. Le icone funzionano offline (nessuna
  richiesta di rete).

## Token usati

`--accent`, `--bg-elevated`, `--text-secondary`, `--danger`, `--border-strong`.
