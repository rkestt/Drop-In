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

## Token usati

`--accent`, `--bg-elevated`, `--text-secondary`, `--danger`.
