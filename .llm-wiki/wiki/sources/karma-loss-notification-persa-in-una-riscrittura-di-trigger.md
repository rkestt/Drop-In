---
type: source
title: "Una riscrittura di trigger ha cancellato un INSERT: le notifiche karma non esistevano più"
slug: karma-loss-notification-persa-in-una-riscrittura-di-trigger
status: insight
category: "sources"
created: 2026-11-12
updated: 2026-11-12
---

# Una riscrittura di trigger ha cancellato un INSERT: le notifiche karma non esistevano più

# Una riscrittura di trigger ha cancellato un INSERT: le notifiche karma non esistevano più

## Sintomo
La sezione karma della storia del profilo (#26) sarebbe rimasta **vuota per costruzione**, senza errori e senza test rossi: nessuna riga `push_notifications` con `data.type = 'karma_loss'` veniva mai creata.

## Causa
- `002_push_notification_triggers.sql` aveva esteso `decrement_karma_on_missed_check_in()` con un `INSERT INTO push_notifications` per ogni partecipante penalizzato.
- `007_fix_checkin_penalty.sql` ha riscritto la stessa funzione per correggere il predicato del check-in (per `lobby_id` invece che `court_id`) usando `CREATE OR REPLACE` **con il corpo ricostruito a mano**: l'INSERT non è stato ricopiato. La migrazione successiva è verde, il trigger funziona, il karma scende — sparisce solo la notifica.

## Lezione
`CREATE OR REPLACE FUNCTION` non è un patch: è una sostituzione totale del corpo. Se una migrazione riscrive una funzione già estesa da un'altra migrazione, il rischio non è "non applicare il fix" ma **perdere silenziosamente le estensioni precedenti**. Un test che fissi il comportamento *osservabile* (delta karma **e** riga di notifica) avrebbe rotto alla 007.

## Fix (027)
`027_karma_loss_notification.sql` ricrea la funzione con il predicato della 007 (invariato) + l'INSERT della 002 (titolo, corpo e payload `{type:'karma_loss', lobby_id, points_lost}` identici, perché `mapKarmaRow` e `notificationHref` li leggono) e aggiunge `SECURITY DEFINER SET search_path = public`: come invoker, l'INSERT sarebbe stato filtrato dalla RLS di `push_notifications` (nessuna policy INSERT) se la lobby fosse stata chiusa da un utente invece che dal cron.

## Test che lo copre
Blocco 38 di `tests/rls/assertions.sql`: corte nuova + utente C + lobby chiusa → karma −3 **e** esattamente una notifica `karma_loss` per quella lobby. Fixture dedicata perché su A restano check-in attivi dai blocchi precedenti e il predicato "nessun check-in attivo sulla corte" escluderebbe la penalità.

## Related
- `supabase/migrations/002_push_notification_triggers.sql`, `007_fix_checkin_penalty.sql`, `027_karma_loss_notification.sql`
- `lib/profile/history.ts` (`mapKarmaRow`)
