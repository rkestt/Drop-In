# Push delivery (issue #25)

Come le righe di `push_notifications` (create dai trigger `002`/`027` e
sempre visibili nel centro notifiche in-app) arrivano come Web Push sul
telefono.

## Architettura

1. Il client fa opt-in da Impostazioni → Notifiche (`enable()` chiede il
   permesso, sottoscrive il `pushManager` e scrive in
   `public.push_subscriptions`). Mai prompt al mount, mai prompt senza
   gesto dell'utente.
2. La Edge Function `supabase/functions/send-push/` spazza ogni minuto le
   righe non recapitate e le invia con `web-push` + VAPID.
3. Il service worker (`app/sw.ts`, listener `push`) mostra la notifica;
   alla pressione apre la rotta derivata da `data` con `notificationHref`
   (`lib/notifications/link`) — l'URL non e' mai calcolato lato server.
4. Marcatori di recapito su `push_notifications` (migrazione `029`):
   `push_sent_at` (recapitata), `push_attempts` (tentativi falliti),
   `push_failed_at` (esauriti i 5 tentativi). `sent_at` ha DEFAULT
   `now()` all'INSERT: marca la creazione, NON il recapito.

## Setup (una volta per progetto: staging, poi prod)

```bash
# 1. Genera la coppia VAPID (una per progetto: staging e prod separate)
npx web-push generate-vapid-keys
```

2. Vercel (scope Preview per lo stage, Production per la prod):
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>`
3. Supabase Dashboard → Project Settings → Edge Functions → Secrets (oppure
   `supabase secrets set`, mai committare i valori):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:<tua-mail>`,
   `PUSH_SECRET=<stringa casuale lunga, es. openssl rand -hex 32>`.
   Lo stesso `PUSH_SECRET` va nel job pg_cron sotto.

```bash
# 4. Deploy della function (dalla root del repo)
supabase functions deploy send-push
```

5. Schedulazione ogni minuto (pg_cron + pg_net; il segreto resta in
   `vault.decrypted_secrets`, mai in chiaro nella migrazione):

```sql
select cron.schedule(
  'send-push-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'push_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Prerequisiti: estensioni `pg_cron`, `pg_net` e schema `vault` attivi sul
progetto (su staging verificare prima con
`select * from pg_extension where extname in ('pg_cron','pg_net')`).

## Budget free plan

Lo sweep gira ogni minuto: ~43.200 invocazioni/mese per progetto. Le Edge
Function contano nelle 500k invocazioni/mese del free plan solo se il
progetto e' collegato (Supabase conta le function attive): con staging +
prod attivi restano ~400k di margine. Se il budget stringe, passare lo
sweep a ogni 5 minuti (`*/5 * * * *`). Niente realtime aggiuntivo: nessun
nuovo canale `.channel(` (restiamo sotto la soglia dei 200).

## iOS

Push solo da iOS 16.4+, solo se la PWA e' installata (Schermo Home). La
riga impostazioni su iPhone non installata spiega di installare l'app e
non chiede il permesso. Su desktop/Android l'installazione non serve.

## Verifica

Dopo il deploy, con due utenti (A crea lobby, B si unisce da Chrome
Android):

```sql
select id, push_sent_at, push_attempts, push_failed_at
from push_notifications order by sent_at desc limit 5;
```

`push_sent_at` valorizzato = recapitata ad almeno un endpoint. B deve
ricevere la push entro ~1 minuto.

Single-shot di una riga (debug):

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer <PUSH_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"<uuid>"}'
# -> {"ok":true,"delivered":1,"noSubscription":0,"failed":0,"skipped":0}
```

`delivered` conta solo le righe inviate ad almeno un endpoint;
`noSubscription` quelle senza endpoint (restano nel centro notifiche).

## Debug 401

- `401 {"ok":false,"error":"Non autorizzato."}`: il Bearer non matcha
  `PUSH_SECRET`. Ricontrolla il secret della function
  (`supabase secrets list`) e quello usato dal cron/curl: sono due posti
  diversi, stesso valore.
- `500 {"ok":false,"error":"Funzione non configurata."}`: manca
  `PUSH_SECRET`, le chiavi VAPID o `SUPABASE_SERVICE_ROLE_KEY` nei secret
  della function (quelli Vercel non contano qui).
- Righe ferme con `push_attempts` che cresce: nessun endpoint valido
  (subscription scadute = 404/410, rimosse da sole) o VAPID errata
  (controlla i log: `supabase functions logs send-push`).
- `push_failed_at` valorizzato: 5 sweep falliti, la riga non viene piu'
  ritentata. Resta comunque nel centro notifiche in-app.

## Cosa non e' verificabile in locale

- Il recapito vero: richiede VAPID reali, HTTPS e un browser con SW
  attivo (il dev server `localhost` non basta per la sottoscrizione su
  telefono). In locale si testa solo la logica pura
  (`deno test supabase/functions/send-push/`,
  `vitest run tests/unit/push-*.test.ts`) e il flusso UI fino alla
  scrittura in `push_subscriptions` contro Supabase locale.
- `supabase functions deploy` / `secrets set` / cron pg_net: solo su
  staging/prod, mai dal dev locale (questa repo non li tocca).
- iOS: solo su iPhone fisico con PWA installata, mai da simulatore.
