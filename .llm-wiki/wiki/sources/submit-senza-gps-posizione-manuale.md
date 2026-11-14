---
type: source
title: "Inviare un campo senza essere sul posto: posizione manuale, indirizzo e bozza migrabile"
slug: submit-senza-gps-posizione-manuale
status: insight
category: "source"
created: 2026-11-13
updated: 2026-11-13
---

# Inviare un campo senza essere sul posto: posizione manuale, indirizzo e bozza migrabile

Il form di invio pretendeva il GPS: chi segnalava un campetto visto ieri non aveva percorso. Ora ci sono tre modi equivalenti di dare la posizione.

## Modello

`CourtPosition = { source: "gps", lat, lng, accuracy } | { source: "manual", lat, lng }` in `lib/court/position.ts`: una sola verità e una **fonte dichiarata**, così la UI può dire "Precisione GPS: N m" oppure "Posizione scelta manualmente" senza inventare numeri.

- Pin su mappa: `components/court/location-picker.tsx`, chunk proprio (`next/dynamic` + `ssr:false`), istanza MapLibre indipendente (non tocca `components/map/**`), pin DOM 44×44 trascinabile, click sulla mappa = sposta, coordinate sincronizzate con due input numerici.
- Coordinate numeriche: la via accessibile completa (canvas decorativo e fuori dal tab order). Parsing rigoroso in `parseCoordinate`: niente esadecimale né notazione scientifica, virgola accettata come separatore decimale.
- `p_gps_accuracy` viene **omesso** quando la posizione è manuale (mai 0, mai un valore finto); `p_address` (migration `031`: trim, max 200, niente newline/control) finisce in `courts.address`.
- Bozza in sessionStorage con forma nuova e `decodeSubmitCourtDraft` che accetta anche la vecchia `location:{lat,lng,accuracy}`: un draft pre-esistente non rompe il form.
- Dedup (`dedup_candidates`) riparte su qualunque posizione, con debounce 400 ms e `dedupConfirmed` riarmato a ogni cambio.

Verificato live: pin + coordinate + indirizzo → riga `pending` con `address` salvato e `gps_accuracy IS NULL`.
