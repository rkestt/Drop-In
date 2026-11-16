---
type: source
title: "Tracker Drop-In: chiudere una issue con evidenza file/migrazione, non con git log"
slug: tracker-issue-evidenza-non-commit
status: insight
category: insight
created: 2026-11-16
updated: 2026-11-16
---

# Tracker Drop-In: chiudere una issue con evidenza file/migrazione, non con git log

# Tracker Drop-In: evidenza nei file, non nei commit

## Contesto

Le issue #11–#35 del repo Drop-In sono state create nel 2026-11-05 copiando la lista "Proposed tickets" di `docs/roadmap.md`. Il lavoro che le ha chiuse è stato committato **senza citare i numeri** (convenzione: `feat(...)`, `fix(...)`, merge con numero di PR). Cercare `(#42)` in `git log` non produce nulla: il collegamento issue → codice esiste solo nel codice.

## Regola operativa

Per chiudere una issue del tracker Drop-In:

1. L'evidenza si cerca nel **codice**, non nella history: `app/`, `components/`, `lib/`, `supabase/migrations/`, `tests/`, `.github/workflows/`.
2. Il commento di chiusura cita **percorsi e migrazioni** ("`lib/map/court-features.ts`", "`030_submission_outcome.sql`"), e i commit solo quando sono davvero risolutivi.
3. Se la feature è parziale: aggiornare il body della issue con una sezione "Stato AAAA-MM-GG" (fatto / resta), non chiudere.
4. Superato ≠ fatto: i ticket di tema (#11–#13) si chiudono come *not planned* con il riferimento alla decisione di design, non come *completed*.
5. Un gap senza ticket va aperto subito: `docs/roadmap.md` tiene la mappa gap → issue, non più proposte senza numero.

## Perché conta

Il tracker era a 38 issue aperte con circa 30 già risolte: senza una ricerca dell'evidenza per file, l'unica fonte erano i commenti delle PR, che non coprono le feature mergiate anni dopo la creazione. La roadmap dichiarava chiuso ciò che il tracker lasciava aperto: due verità in conflitto, che rendono inutile sia la roadmap che il tracker.
