---
type: source
title: "Moderazione: esito al proponente, resubmit e storia di audit che non si riscrive"
slug: moderazione-esito-notifiche-resubmit
status: insight
category: "source"
created: 2026-11-13
updated: 2026-11-13
---

# Moderazione: esito al proponente, resubmit e storia di audit che non si riscrive

La coda di moderazione esisteva solo da Studio: nessuna UI, nessun ritorno all'utente, nessun percorso di correzione dopo un rifiuto.

## Cosa è stato deciso

- `approve_court`/`reject_court` inseriscono **una** notifica `push_notifications` (via `notify_user`) solo dopo una transizione reale: UPDATE condizionato a `moderation_status = 'pending'` + `ROW_COUNT = 0 → P0001`. Doppio click o retry non producono una seconda notifica.
- `resubmit_submission(p_court_id)`: il proprietario rimette in `pending` la propria rifiutata e crea una **nuova** riga in `court_submissions`; la riga `rejected` resta come storia. Limiti anti-abuso letti dalle righe (1 per corte al minuto, 5 pending/ora per utente) con `pg_advisory_xact_lock` per utente; il rate limit 1/ora di `submit_court` non si applica, è una correzione.
- UI: la sezione "Le tue proposte" chiede `in ('pending','rejected')`, mostra `Rifiutata` + `Motivo:` (la nota vive in `court_submissions`, non in `courts`) e il bottone `Riprova`; `Modifica`/`Ritira` restano solo sulle pending.
- `/admin`: gate server-side in due passi (sessione → `profiles.is_moderator`) e RPC che si autoproteggono, quindi il gate client non è l'unica difesa. Coda FIFO con tetto 200, dedup con righe altrui mascherate, refetch dopo l'azione senza optimistic update; segnalazioni attive in sola lettura.

## Il bug che la review ha trovato

`UPDATE court_submissions SET status = … WHERE court_id = …` **senza filtro di stato** riscriveva tutta la storia: dopo reject → resubmit → approve, la vecchia riga rifiutata diventava `approved` e il suo `moderation_note` restava con uno stato falso. Fix: `AND status = 'pending'` in tutte le funzioni di moderazione (migration `032` per `mark_duplicate`, che viveva in una migrazione già applicata). Le asserzioni RLS §41–43 ora inchiodano: storia intatta, una sola notifica, secondo approve che fallisce con P0001.

Migration: `030_submission_outcome.sql`, `032_mark_duplicate_pending_audit.sql`. Docs: `docs/moderation.md`.
