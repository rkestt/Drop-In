---
type: source
title: "Drop-In: l'occorrenza esisteva già, il costo della ricorrenza è nel karma"
slug: lobby-gia-e-l-occorrenza-il-costo-e-nel-karma
status: insight
category: "concept"
created: 2026-11-16
updated: 2026-11-16
---

# Drop-In: l'occorrenza esisteva già, il costo della ricorrenza è nel karma

# L'occorrenza esisteva già, il costo della ricorrenza è nel karma

## Cosa credevamo

Introdurre l'appuntamento ricorrente sembrava richiedere tre oggetti nuovi: l'appuntamento (campo + giorno + ora), l'occorrenza (la data concreta), la conferma (l'impegno anticipato).

## Cosa è vero

Tre su tre esistevano già.

- `lobbies` è già l'occorrenza: `court_id`, `start_time`, `max_players`, `status`, partecipanti, realtime, chiusura automatica, penale.
- `lobby_participants` è già la conferma: unico per utente, ritirabile, con conseguenza se non ti presenti. Si chiama "Unisciti" ed è per questo che non sembrava.
- La ricorrenza dedotta dallo storico non richiede schema: è una lettura su `check_ins`.

Delta reale: tabella `lobby_series`, una colonna `lobbies.series_id`, un unique `(series_id, start_time)`, un generatore.

## Dove sta il costo

Non negli oggetti nuovi ma in quattro meccanismi esistenti che le occorrenze future mandano in tilt:

1. `auto_close_lobbies` (+30 min) lascia `open` le occorrenze future, che saturano `open_lobbies` (tetto 100, ordinate per `start_time`): le partite di stasera spariscono.
2. `decrement_karma_on_missed_check_in` (mig. 027) penalizza a ogni chiusura: applicato a N occorrenze future uccide il karma di ogni utente.
3. Confronta per `court_id` invece che per partita: due occorrenze sullo stesso campo si coprono a vicenda.
4. `check_ins.lobby_id` è sempre NULL perché il client non lo passa: l'aggancio partita↔check-in esiste nello schema e non nei dati.

## La regola che ne è uscita

La conferma a distanza non è punibile. A ridosso dell'occorrenza si chiede una **riconferma**: chi non riconferma si considera fuori e non perde nulla; il -3 scatta solo se hai riconfermato e non ti presenti.

## Lezione

Prima di progettare oggetti nuovi, leggere lo schema: qui l'oggetto c'era, e il costo era nelle regole che ci ruotavano attorno. Un modello dati che sembra mancare spesso è solo un modello dati con nomi diversi.

## Related

- `sources/moderazione-esito-notifiche-resubmit` — stessa lezione applicata alle notifiche
