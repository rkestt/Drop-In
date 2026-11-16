---
type: source
title: "Verificare la Web Push su staging senza leggere i secret"
slug: verifica-push-staging-senza-leggere-i-secret
status: insight
category: "source"
created: 2026-11-16
updated: 2026-11-16
---

# Verificare la Web Push su staging senza leggere i secret

# Verificare la Web Push su staging senza leggere i secret

`supabase secrets list` **non restituisce i valori**, solo un hash: non si può
confrontare `VAPID_PUBLIC_KEY` (function) con `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
(Vercel) leggendoli. Stessa cosa per `PUSH_SECRET` vs `vault.push_secret`.

## Prova funzionale, in ordine di costo

1. **Il cron parla davvero con la function**: `select status_code, content from
   net._http_response order by created desc limit 5` → `200`,
   `{"ok":true,...}`. Un 401 lì significa `PUSH_SECRET` disallineato tra vault
   e function, non VAPID.
2. **Il recapito reale**: inserire una riga in `push_notifications` per un
   utente che ha una subscription valida e aspettare lo sweep
   (`* * * * *`): `push_sent_at` valorizzato + `push_attempts = 0` entro un
   minuto. Con VAPID diverse il push service risponde 401/403 e
   `push_attempts` sale.
3. **Percorso dei trigger, senza due telefoni**: creare la lobby come utente A,
   inserire il partecipante B in `lobby_participants` (SQL, come postgres) →
   il trigger `notify_participant_joined` crea la notifica per A, che è
   automaticamente recapitata all'endpoint reale di A. Copre trigger +
   sweep + delivery in un solo giro.

Serve una subscription vera: si crea solo da un browser con SW attivo su
HTTPS (stage), non dal dev server.

## Trappole

- `sent_at` ha DEFAULT `now()` all'INSERT: marca la creazione, non il recapito.
  Solo `push_sent_at` prova la consegna.
- Cancellare la lobby di prova con `delete from lobbies` fa cascare il
  partecipante; le notifiche restano (sono l'evidenza).
- `db query --remote` non può leggere `vault.decrypted_secrets`
  (`42501 permission denied for function _crypto_aead_det_decrypt`).

## Related

- `staging-env-vercel-preview-supabase-free`
- `docs/push.md` (§ Stato staging)
