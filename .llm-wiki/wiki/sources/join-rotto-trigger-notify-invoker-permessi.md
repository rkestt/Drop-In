---
type: source
title: "Join alla lobby rotto: il trigger di notifica invoker contro il REVOKE della 035"
slug: join-rotto-trigger-notify-invoker-permessi
status: insight
category: "source"
created: 2026-11-18
updated: 2026-11-18
---

# Join alla lobby rotto: il trigger di notifica invoker contro il REVOKE della 035

Trovato e risolto il 2026-11-18 (issue #100, migrazione `040_fix_notify_definer.sql`).

## Cosa succedeva

`INSERT INTO lobby_participants` da un utente autenticato → `permission denied for table push_notifications` → join fallito. Il loop centrale del prodotto (qualcuno crea, gli altri si uniscono) era rotto per tutti tranne il creatore.

## Perché, in tre passaggi

1. `notify_participant_joined()` (`002_push_notification_triggers.sql:37`) è **SECURITY INVOKER**: gira con i permessi di chi inserisce.
2. Dentro fa `INSERT INTO push_notifications` per avvisare il creatore.
3. `035_harden_grants.sql:66-67` fa `REVOKE ALL ... FROM anon, authenticated` e concede solo `SELECT, UPDATE`. Nessun INSERT → eccezione → l'INSERT esterno viene annullato con lui, perché un trigger `AFTER` che solleva annulla la transazione.

## Perché nessun test lo vedeva

Gli INSERT di `tests/rls/assertions.sql` giravano con privilegi **non** quelli del client: il trigger passava e la regressione restava invisibile. La correzione include un blocco che fa il join **come secondo utente autenticato** e pretende il successo.

Regola generale: una funzione usata da trigger deve scrivere su tabelle che il chiamante non può scrivere → `SECURITY DEFINER` con `SET search_path = public`. Le eccezioni (`notify_user`, chiamata solo da altre funzioni `DEFINER`) vanno motivate nel commento.

## Come riprodurre in locale

```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<joiner>","role":"authenticated"}';
INSERT INTO lobby_participants (lobby_id, user_id) VALUES ('<lobby altrui>', '<joiner>');
-- prima: ERROR permission denied for table push_notifications
ROLLBACK;
```

## Related

- [[test-all-verde-perche-meta-degli-e2e-si-skippa]]
