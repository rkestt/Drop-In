# Mappa: stile upstream, marker/cluster, errori tile, coordinate

`components/map/court-map.tsx` monta MapLibre GL sullo stile vettoriale
OpenFreeMap Liberty (`lib/map/provider.ts`). Qui stanno le trappole runtime;
il linguaggio visivo dei marker e i parametri di clustering sono in
`docs/design/patterns/map.md`.

## Marker e clustering (#41, #42)

I campi non sono più `maplibregl.Marker` DOM: una source GeoJSON `courts`
con cluster e sei layer `courts-*`. Il puro vive in `lib/map/court-features.ts`
(FeatureCollection, stati/colori, taglie cluster, lista accessibile) ed è
coperto da `tests/unit/map-court-features.test.ts`.

Punti che contano:

- **Un solo source** con `cluster: true`, `clusterRadius: 50`,
  `clusterMaxZoom: 14`, `clusterMinPoints: 2`, `promoteId: "courtId"`.
  `promoteId` rende l’id del campo il feature id: serve a `setFeatureState`
  per l’hover (raggio +2).
- **FeatureCollection in un ref**: `setData` su cambio campi/selezione; se
  `setStyle` ricrea lo stile, `style.load` ricrea source e layer dalla stessa
  collezione (la camera resta). Lo stesso vale dopo un retry, che ricrea
  l’intera istanza.
- **Coordinate non finite**: `buildCourtFeatureCollection` scarta le feature
  con lat/lng non finiti (difesa doppia rispetto a `hasFiniteCourtCoords` in
  `lib/courts/search.ts`).
- **Click**: prima il cluster esatto (`getClusterExpansionZoom` → `easeTo`,
  tetto z17); poi i punti con un padding di 22px per lato, quindi un target
  di 44×44px anche se il cerchio è più piccolo.
- **Niente collisioni con `dropin-barriers`**: i layer `courts-*` sono
  aggiunti sopra, su una source diversa; il gap-filler delle barriere resta
  ancorato a `openmaptiles`.
- **Font**: i layer con testo usano `Noto Sans Bold`, l’unica famiglia bold
  servita dai glyphs di Liberty (verificato sullo stile upstream). Cambiando
  provider vanno riverificati `text-font` e i glyphs.

## Errori tile dopo il load (#39)

- **Pre-load**: un errore di stile/mappa mostra l’overlay a schermo intero
  con “Riprova”. **WebGL context lost**: overlay + retry, invariati.
- **Post-load**: gli errori passano da `classifyTileError`
  (`lib/map/tile-errors.ts`) e da una finestra scorrevole di 10s.
  Classificazione: `transport` (fetch/network), `server` (5xx), `blocked`
  (401/403/429), `not-found` (404). Errori su host diversi dalle tile e
  messaggi non di rete (immagini, warning di filtro) sono `ignore`.
- **404**: uno solo non conta; da tre nella finestra contano tutti. Soglia
  banner: 5 errori “veri” in 10s.
- **Banner non bloccante** (mai l’overlay se la mappa ha già dipinto):
  messaggio, “Riprova” che ricrea l’istanza dal path esistente e “Chiudi”
  che silenzia il banner. Il prossimo tile valido lo chiude da solo.
- **Recupero**: `sourcedata` con `sourceId` della source tile,
  `sourceDataType: "content"` e `tile` presente. `idle` non è usato:
  MapLibre va in idle anche quando tutti i tile sono in errore, quindi
  chiuderebbe il banner mentre la mappa è ancora vuota.
- La source delle tile è distinta da `courts`: `MAP_TILE_SOURCE_ID`
  (`openmaptiles` per OpenFreeMap, `osm` per il raster).

## Warning "Expected value to be of type number, but found null instead" (#79)

**Causa: lo stile upstream, non il nostro codice.** La stringa esiste solo
in `Assertion.evaluate` di maplibre-gl e le assertion vengono iniettate
solo per confronti d'ordine con operando sinistro non tipizzato. Nei nostri
layer non ce ne sono (match su stringhe/booleani, `text-size` e
`circle-*` letterali): il warning viene dai layer Liberty che confrontano
proprieta' che non tutte le feature hanno (manca la proprieta' → `["get", …]`
valuta null):

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

`setLngLat` con NaN/null piazza marker fantasma. Difesa su tre livelli:

1. `hasFiniteCourtCoords` (`lib/courts/search.ts`): filtra le liste dove
   nascono — browse `courts_in_viewport`, ricerca `nearby_courts`,
   fallback cache offline in lettura (`app/(app)/page.tsx`).
2. `buildCourtFeatureCollection` (`lib/map/court-features.ts`) scarta
   comunque le feature non finite prima di costruire la geometria GeoJSON.
3. `court-map.tsx` salta la `userLocation` non finita prima di `flyTo`.

## Tastiera e screen reader (#44)

- Un solo tab stop per la superficie mappa: il contenitore è `tabIndex=0`,
  il canvas è `aria-hidden` e `tabindex="-1"`, l’handler tastiera di
  MapLibre è disattivato (`map.keyboard.disable()`), così frecce/+/-/Home
  non vengono gestiti due volte.
- Mappatura: frecce = pan 100px; `+`/`=` e `-`/`_` = zoom; `Home` =
  posizione utente o Roma. `preventDefault` solo sui tasti gestiti.
- Canvas e marker non sono più nodi accessibili: i nomi dei campi vivono
  nella lista (“Lista campi”, dialog non modale, 30 voci ordinate) e
  nell’anteprima. La live region della home annuncia conteggio e selezione.
- Il focus torna alla regione mappa alla chiusura dell’anteprima
  (`finalFocus` del Drawer).

## Attribuzione

L'attribuzione la fornisce lo stile Liberty (per OpenFreeMap) o la `source`
raster (per OSM). Non va passata anche in `attributionControl.customAttribution`:
prima era un oggetto (quindi scartato) e, una volta corretta la stringa,
compariva due volte. Il controllo resta `compact: false`.
