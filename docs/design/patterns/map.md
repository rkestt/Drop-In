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
  icone, nessun match). I tile OpenFreeMap arrivano solo fino a z14
  (TileJSON `maxzoom: 14`, oltre si va in overzoom) e non contengono
  `barrier_line`.
- I layer POI dello stile (`poi_r20/r7/r1`, `poi_transit`) risolvono
  `icon-image` per classe (`gate`, `bollard`, `lift_gate`, `cycle_barrier`
  arrivano dal layer `poi`): senza sprite dedicati MapLibre logga
  `Image "gate" could not be loaded`.
- Liberty mostra i POI barriera per rank: `poi_r1` a z15 (rank 1–6),
  `poi_r7` a z16 (rank 7–19), `poi_r20` a z17 (rank 20+). A Villa Borghese
  294/295 barriere hanno rank ≥ 20, quindi a z16 lo stock ne disegna 1 sola.
- `dropin-barriers` è il nostro gap-filler su `source-layer: "poi"` da
  z16 (nessun `maxzoom`; a z17+ c'è doppio disegno con `poi_r20`: stessa
  immagine e ancora; size 0.8 vs 1.0 stock e overlap nostro: a z17 le icone
  stock crescono e possono cullare, il nostro layer resta sotto — salto
  lieve accettato): `filter` match sulle 5 classi
  barriera, `icon-image` match `gate`+`lift_gate` → gate, resto → bollard,
  icon-size 0.8, overlap. Icone inline da `lib/map/icons.ts` (SVG data URI,
  colore da `--text-secondary` con fallback `--border-strong`, mai hex:
  lo impone `lint:design`), registrate con `addImage` + `pixelRatio: 2`
  dopo il `load` e prima di `addLayer`.
- Il layer è accoppiato ai rank di Liberty: se lo stile cambia rank,
  riverificare i conteggi a z16.
- Nota tecnica: `map.loadImage` non decodifica gli SVG in Chromium
  (`createImageBitmap` → `InvalidStateError`), quindi le icone si caricano
  con `HTMLImageElement` + `addImage`. Le icone funzionano offline (nessuna
  richiesta di rete); se la registrazione fallisce: un solo `console.warn`,
  nessun retry infinito.

## Token usati

`--accent`, `--bg-elevated`, `--text-secondary`, `--danger`, `--border-strong`.
