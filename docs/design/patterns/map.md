# Pattern: mappa

## Stile

- Provider: **OpenFreeMap**.
- Stile: **liberty** (sempre chiaro, decisione [0002](../decisions/0002-mappa-light.md)).
- La mappa non cambia tema con l’app: il chrome è dark, il basemap resta light.
- I marker devono quindi leggersi **sul chiaro** e staccarsi dal chrome scuro: ogni punto ha un anello `--bg-elevated`, mai un bordo bianco.

## Linguaggio marker (#41)

Cinque stati, distinguibili **senza click**. Non solo colore: cambiano forma, dimensione e segno interno, così restano leggibili anche a chi non distingue verde/rosso.

| Stato | Forma | Raggio | Riempimento | Anello | Segno | Significato |
|---|---|---|---|---|---|---|
| **default** | cerchio pieno | 7px | `--accent` | `--bg-elevated` 2px | — | campo normale |
| **preferito** | ciambella (centro scuro) | 7px | `--bg-elevated` | `--accent` 3px | — | salvato nei preferiti (`user_favorites`) |
| **lobby attiva** | cerchio pieno grande | 11px | `--accent` | `--bg-elevated` 2.5px | numero lobby, 11px bold `--accent-foreground` | almeno una lobby aperta |
| **segnalato** | cerchio pieno | 8px | `--danger` | `--bg-elevated` 2px | `!`, 12px bold `--danger-foreground` | report attivo (`court_reports` non scaduto) |
| **selezionato** | piastra dietro al punto | raggio + 7px | `--bg-elevated` 92% | `--accent-hover` 2px | — | anteprima aperta |

Regole:

- **Priorità di stato**: `segnalato` > `lobby attiva` > `preferito` > `default`. Un marker racconta lo stato più urgente; l’anteprima mostra tutto (badge sport, fondo, segnalazione, preferito). `selezionato` si compone con qualunque stato.
- **Hover**: raggio +2px e cursore pointer (`feature-state`), solo feedback visivo.
- **Target touch**: il cerchio è piccolo, il target no. Il click interroga la mappa con **22px di padding per lato** attorno al dito: 44×44px effettivi, come ogni controllo del progetto.
- **Colori**: solo token, risolti a runtime da `getComputedStyle` (MapLibre non legge le CSS custom property). Nessun esadecimale nei componenti: `lint:design` lo impone.
- **Numero lobby**: da 1 a 9, poi `9+` (dentro un cerchio da 22px non ci sta altro).
- Marker di stato: il numero sul cluster non è un’etichetta di campo, è la densità.

## Clustering (#42)

- Source GeoJSON **`courts`** con `cluster: true`, `clusterRadius: 50`, `clusterMaxZoom: 14`, `clusterMinPoints: 2`, `promoteId: "courtId"` (feature id = id campo, serve a `setFeatureState`).
- Layer, dal basso: `courts-selected-halo`, `courts-points`, `courts-lobby-count`, `courts-reported-glyph`, `courts-clusters`, `courts-cluster-count`.
- I punti escludono le feature con `point_count`; i cluster le includono. I due set non si sovrappongono.
- Cluster: cerchio `--bg-elevated` con anello `--accent` 3px; diametro a scaglioni **34 / 42 / 50 / 58px** (0, 10, 50, 200 punti). Conteggio in `--text-primary` 12px bold, sempre visibile (`text-allow-overlap`, `text-ignore-placement`). A zoom 14 con 200 campi i gruppi sono pochi e leggibili.
- Tap su un cluster: `getClusterExpansionZoom` e `easeTo` (tetto z17), non un nuovo fetch.
- **Sopravvivenza**: `setStyle` rimuove source e layer → `style.load` li ricrea dalla FeatureCollection tenuta in un ref; `setData` aggiorna dati e selezione senza ricreare la mappa. Retry e WebGL-context-lost passano dal path esistente (istanza ricreata, stessa camera di default).
- Il layer **`dropin-barriers`** resta com’è: i layer `courts-*` sono aggiunti sopra (nessuna collisione di source id, nessun filtro condiviso).

## Anteprima invece di navigazione (#43)

- Tap su un punto → **bottom sheet** (`components/map/court-preview-sheet.tsx`), non `window.location.href`.
- Contenuto: miniatura foto, nome, indirizzo, sport e fondo, numero di lobby attive, avviso se segnalato, badge “Salvato” se preferito.
- Azioni: **“Apri dettaglio”** (`<Link href={/courts/id}>`, navigazione client) e **“Chiudi”**.
- Chiusura: swipe, tap sul backdrop, `Escape`, “Chiudi”. Il focus torna alla regione mappa; camera, marker e dati restano quelli di prima (nessun reload, nessun rifetch).
- Se un refetch toglie il campo dall’elenco (pan o ricerca svuotata), l’anteprima si chiude da sola.

## Lista accessibile dei campi (#44)

- Un bottone **“Lista campi”** (44px, in basso a sinistra sulla mappa) apre un pannello `role="dialog"` **non modale**: ordine alfabetico italiano, tetto **30** voci, contatore “30 di N campi”.
- Ogni voce è un bottone con nome e indirizzo: Invio apre l’anteprima e sposta la mappa sul campo (`easeTo`, zoom minimo 15).
- Nessun focus trap: Tab attraversa la lista ed esce; `Escape` chiude e riporta il focus al bottone che l’ha aperta. Il primo elemento è focalizzato all’apertura.
- La lista è l’alternativa leggibile ai punti: i campi sulla mappa non sono più nodi DOM.

## Interazione e tastiera

| Input | Effetto |
|---|---|
| Frecce | pan di 100px |
| `+` / `=` | zoom +1 |
| `-` / `_` | zoom −1 |
| `Home` | torna su posizione utente (z15) o Roma (z14) |
| Tap su punto | anteprima |
| Tap su cluster | espansione |
| Drag / pinch | nativi MapLibre |

- La superficie mappa è **un solo tab stop**; il canvas è `aria-hidden` e fuori dal tab order. L’handler tastiera di MapLibre è disattivato: i tasti li gestisce il contenitore, così non si duplicano.
- Il focus visibile sulla mappa è l’anello `--focus-ring` (inset, per non finire tagliato dai bordi).
- Testo guida per screen reader via `aria-describedby`.

## Annunci (#44)

- La home ha **una sola** live region per i campi: al caricamento annuncia “N campi visibili per …”, alla selezione “<nome> selezionato. N campi visibili.”, alla chiusura “Anteprima chiusa”.
- Lo stato dei marker (segnalato, lobby, preferito) non è annunciato a raffica: arriva quando si apre l’anteprima o si scorre la lista.

## Errori tile dopo il load (#39)

- Pre-load: errore → overlay a schermo intero (comportamento invariato). WebGL context lost: overlay + retry (invariato).
- Post-load: gli errori tile si **aggregano** in una finestra di 10s. Contano trasporto, 5xx, 401/403/429; un singolo 404 è ignorato, tre 404 nella finestra contano. Soglia: 5 errori → banner.
- Banner **non bloccante** in basso sulla mappa: “La mappa non si sta caricando bene…”, “Riprova” (ricrea l’istanza dal path esistente) e “Chiudi”.
- Auto-dismiss al primo tile arrivato davvero (`sourcedata` con `sourceDataType: "content"`). `idle` non è un segnale di recupero: MapLibre va in idle anche quando tutti i tile sono in errore.
- “Chiudi” silenzia il banner finché non tornano tile validi: dopo un recupero un nuovo guasto può riaprirlo.

## Stati

| Stato | Comportamento |
|---|---|
| Caricamento | `MapSkeleton` con `dynamic` import. |
| Errore geolocalizzazione | Fallback su centro di Roma, messaggio discreto in alto. |
| Nessun campo | Banner inline sulla mappa (page). |
| Tile parziali | Banner non bloccante, mai overlay se la mappa ha già dipinto. |

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

`--accent`, `--accent-hover`, `--accent-foreground`, `--danger`,
`--danger-foreground`, `--danger-dark`, `--success` (posizione utente),
`--bg-elevated`, `--bg-surface`, `--border`, `--border-strong`,
`--text-primary`, `--text-secondary`, `--text-muted`, `--focus-ring`,
`--overlay`.
