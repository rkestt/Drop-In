---
type: source
title: "Mappa: da 200 marker DOM a source GeoJSON con cluster, anteprima e un solo tab stop"
slug: mappa-marker-geojson-clustering-preview
status: insight
category: "source"
created: 2026-11-13
updated: 2026-11-13
---

# Mappa: da 200 marker DOM a source GeoJSON con cluster, anteprima e un solo tab stop

La mappa reggeva 200 `maplibregl.Marker` DOM: 200 nodi, 200 listener, 200 tab stop e, a zoom 14, un blob indistinguibile. La migrazione a source GeoJSON chiude tre problemi con una mossa sola.

## Decisione

- Source `courts` con `cluster: true`, `clusterRadius 50`, `clusterMaxZoom 14`, `clusterMinPoints 2`, `promoteId: "courtId"`.
- Sei layer sopra: piastra di selezione, punti, numero lobby, glifo "segnalato", cluster, conteggio del cluster. Cluster 34–58 px su soglie 0/10/50/200; tap su un cluster → `getClusterExpansionZoom` + `easeTo` (max z17).
- Stati risolti in `lib/map/court-features.ts` (puro) con i **nomi** dei token, letti a runtime da `readCourtPalette`; priorità `segnalato > lobby > preferito > default`, la selezione si compone. Mai hex nuovi: `lint:design` li rifiuterebbe.
- Interazione (click/hover/query con padding 22 px = target 44 px) estratta in `lib/map/interactions.ts`; il lifecycle MapLibre resta in `court-map.tsx`.

## Trappole pagate

- `style.load` (cambio stile/retry) **distrugge** source, layer e `feature-state`: i layer vanno ricreati dal ref, e lo stato hover va azzerato esplicitamente. Senza `resetHover()`, il primo `mousemove` sulla stessa feature fa early-return `id === hoveredId` e il +2 px non torna mai.
- Un click su un punto apre un'**anteprima** (bottom sheet con foto, nome, indirizzo, lobby attive, CTA `Link` client), non più `window.location.href`: la navigazione dura ricostruiva la mappa e faceva sembrare i marker inutili.
- **A11y**: la superficie è un solo tab stop (`role=group` "Area mappa interattiva", frecce = pan, `+/- = zoom, `Home` = ricentra), canvas `aria-hidden` e fuori dal tab order; alternativa completa = bottone "Lista campi" con le 30 voci ordinate (dialog non modale, Enter apre l'anteprima, Esc restituisce il focus). Una sola live region annuncia selezione e conteggio. Il claim va tenuto onesto: i controlli zoom/attribuzione di MapLibre restano tabbabili.
- Errori tile post-load: classificazione + finestra 10 s + soglia 5, banner **non bloccante** con Riprova/Chiudi e auto-dismiss solo su `sourcedata` con `content` (non su `idle`, che scatta anche con tile fallite). Con tile in cache il banner può non sparire da solo: è il prezzo di non mentire.

Verificato live: cluster→zoom, preview senza reload, Esc con camera intatta, lista da tastiera, axe 0 violazioni su `/`.

File: `lib/map/{court-features,palette,interactions,keyboard,resize,tile-errors,tile-watch,barriers}.ts`, `components/map/{court-map,court-preview-sheet,map-court-list}.tsx`.
