---
type: source
title: "Check-in Drop-In: accuratezza GPS adattiva e permessi posizione iOS separati dalla PWA"
slug: drop-in-check-in-accuratezza-adattiva-e-permessi-ios
status: insight
category: "source"
created: 2026-11-15
updated: 2026-11-15
---

# Check-in Drop-In: accuratezza GPS adattiva e permessi posizione iOS separati dalla PWA

Il check-in rifiutava con soglia secca 20 m di accuratezza: su iPhone (GPS di serie più rumoroso) il check-in era di fatto impossibile. Soglia sostituita da tre livelli (#82): <=20 m ok, 20-50 m warning non bloccante (l'insert parte, avviso `role="status"` visibile prima e dopo), >50 m bloccato.

## Perché un verdetto, non un errore
`fromAccuracy()` ritorna `{ level: "ok" | "warn" | "block", info }` invece di `CheckInErrorInfo | null`: il warning e il blocco condividono `kind: "low-accuracy"` ma non lo stesso percorso UI. Un errore con `retryLabel` era la forma sbagliata per lo stato intermedio, e la sheet non deve disabilitare il bottone in warn.
Input non giudicabili (`NaN`, `Infinity`, negativi) → `ok`, mai un banner "±NaN m": il trigger DB sulla distanza resta il giudice finale.

## Permessi iOS: Safari e PWA installata sono due mondi
Su iOS il permesso posizione concesso a Safari **non** vale per la PWA aggiunta alla Home (e viceversa): sono voci distinte in Impostazioni > Privacy e sicurezza > Localizzazione. Da qui il messaggio specifico per `code === 1` con i passi iOS, e il ramo `standalone === false` che manda a riaprire Drop-In dall'icona. Il modulo resta puro: `fromGeolocationCode(code, { ios, standalone })` riceve i flag dal client (`isIosDevice(navigator.userAgent)` + display-mode), niente `navigator` nel modulo.
Serve anche "Posizione precisa" attiva: su iOS il GPS approssimato da solo può produrre accuratezze >20 m.

## Trappola
La checklist iPhone va aggiornata insieme al codice (permessi Chiedi/Mai/Durante l'uso, warning 20-50 m, blocco >50 m), altrimenti il retest fra due settimane non copre il caso nuovo.
