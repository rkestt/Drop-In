---
id: d22
type: impl
hitl: false
claimed: false
blocked_by: [d14, d5, d6]
---
## Question

**Obiettivo.** Implementare il centro notifiche approvato in `d14`: lista reale da `push_notifications`, letto/non letto persistente, deep link, stato vuoto. Il permesso push resta fuori scope finché non esiste il delivery lato server.

**Prerequisiti.** Prototipo `docs/design/prototypes/notifications.html` approvato (leggi la Resolution di `d14`). `Drawer` (`d5`) e Sonner (`d6`) disponibili. I frame 1–2 del prototipo sono marcati "futuro" e **non** si implementano.

**File coinvolti.**

- `app/(dashboard)/notifications/page.tsx` (nuovo, server): auth guard, prima pagina di notifiche.
- `components/notifications/notification-list.tsx` (nuovo, client): lista, realtime, segna come letta, "segna tutte".
- `components/notifications/notification-item.tsx` (nuovo): icona per tipo, titolo, corpo, ora relativa, pallino, link.
- `lib/notifications/link.ts` (nuovo, puro): da `data` JSONB a href sicuro (`/courts/<uuid>` o `/lobbies/<uuid>`), altrimenti `null`; valida gli UUID.
- `tests/unit/notifications-link.test.ts` (nuovo).
- `app/(app)/layout.tsx` o header mappa: campanella con badge non letto (se il prototipo la prevede) che porta a `/notifications`; conteggio reale.
- `supabase/migrations/015_notification_read.sql` (nuovo): policy `UPDATE` per `read_at` (own rows) e aggiunta di `push_notifications` alla publication `supabase_realtime`.
- `docs/design/specs/notifiche.md` (nuovo).

**Comportamento.**

- Lista ordinata per `sent_at` desc; 20 per pagina, "Carica altre" se serve.
- Non letta = `read_at IS NULL`: pallino + titolo in peso maggiore + `sr-only` "Non letta".
- Tap su una notifica: se `read_at` è null, aggiorna `read_at` (optimistic + rollback su errore) e naviga se `lib/notifications/link` restituisce un href; altrimenti resta e mostra il dettaglio nel corpo.
- "Segna tutte come lette": update di tutte le non lette; disabilitato se non ce ne sono.
- Realtime: nuova riga → prepend in lista + `toast()` Sonner; una sola volta per id.
- Vuoto: "Nessuna notifica. Ti avvisiamo qui quando cambia qualcosa." + secondaria verso le impostazioni.
- Errore di caricamento: messaggio + "Riprova"; offline: banner "Dati di N min fa" (riusa `d24` se chiuso, altrimenti stato semplice).
- Nessun `Notification.requestPermission()`.

**Regole.**

- Il testo push non promette notifiche di sistema: "Avvisi dell'app".
- Il badge non letto non è l'unico segnale: c'è il pallino nella riga e il testo per screen reader.
- Nessun tipo inventato: i titoli/corpi arrivano dal DB; le icone si scelgono dal campo `data.kind` se presente, altrimenti un'icona neutra.
- Non marcare come letta una notifica che l'utente non ha aperto (solo tap esplicito o "segna tutte").

**Acceptance.**

- `015_notification_read.sql` applicata con `npx supabase db reset`: un utente può aggiornare solo le proprie righe; un altro utente non può.
- Realtime: inserendo una riga in `push_notifications` per l'utente, la lista si aggiorna senza reload e compare un solo toast.
- Mark all: tutte le righe hanno `read_at` valorizzato; dopo reload restano lette.
- Deep link: una notifica con `data.court_id` porta a `/courts/<id>`; un `data` malformato non naviga e non lancia errori.
- `tests/unit/notifications-link.test.ts` verde.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npx supabase db reset
npx vitest run tests/unit/notifications-link.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: insert into push_notifications ... ; aprire /notifications; tap, segna tutte, reload
```

**Riferimenti.** `supabase/migrations/001_initial_schema.sql` (`push_notifications`), `docs/roadmap.md` (push parziale), `docs/design/prototypes/notifications.html`.

## Resolution

Implementato e verificato il 2026-11-10 su `fix/d22-f3` (base `design/1.5`).

**Migrazione.** `supabase/migrations/016_notification_read.sql` (015 era già
occupata da `profiles` realtime): policy UPDATE own rows su `read_at` +
`push_notifications` nella publication `supabase_realtime` (entrambe con
guardia idempotente). Applicata con `npx supabase migration up`; verificata
via psql (2 policy SELECT/UPDATE, tabella in publication) e con nuova sezione
27 in `tests/rls/assertions.sql` (own UPDATE ok, altro utente e anon: 0 righe
toccate) — `npm run test:rls` verde.

**File.** `lib/notifications/link.ts` (href/kind/ora relativa, puri) +
`tests/unit/notifications-link.test.ts` (28 test);
`components/notifications/notification-{item,list,bell}.tsx`;
`app/(dashboard)/notifications/page.tsx` (server, auth guard, 20 righe
`sent_at desc`); campanella montata su overlay mappa (alto-destra) e header
`(dashboard)`; keyframes `notification-flash` in `globals.css`;
`docs/design/specs/notifiche.md`.

**Live verificato (dev 3113, utente reale via modale, seed SQL):** campanella
mappa "Notifiche, 2 non lette"; lista 3 righe + badge "2 non lette"; realtime
INSERT → prepend + toast, una sola volta; tap riga court → naviga
`/courts/<uuid>` e resta letta; badge dopo tap "2 non lette"; riga malformata
resta su `/notifications`; segna-tutte PATCH 204, nessun toast errore,
persistente dopo reload, poi bottone nascosto; vuoto/errore/offline come da
prototipo; console pulita, zero hydration error. Screenshot 360/768 in
`/tmp/opencode/d22-{lista,realtime,lista-768,vuoto}-360/768.png`.
`test:a11y` (3/3 suite) + axe scratch su `/notifications` autenticata: 0
violazioni (trovata e fixata `label-content-name-mismatch` sul bottone
senza href — tolta l'aria-label ridondante).

**Non verificato live (auth):** flussi che richiedono altri utenti reali
(notifica cross-utente); offline reale (simulato via eventi, banner
verificato solo in codice + review prototipo).

**Scostamenti dal ticket.**
1. `lobby_id` senza `court_id` → `/lobbies` (lista), non `/lobbies/<uuid>`:
   la route dettaglio non esiste, un href lì darebbe 404. Contratto fissato
   nel test; basta cambiare `notificationHref` quando nasce il dettaglio.
2. Vuoto: secondaria "Vai al profilo" (`/profile`) invece di "Attiva le
   notifiche" → il frame Permesso è futuro e `requestPermission` è vietato;
   registrata anche in `docs/design/specs/notifiche.md`.
3. Titolo riga `text-base` invece di 15px: scala token chiusa
   (`lint:design`), gerarchia invariata (bold 16 vs body 14).

## Review oracle (APPROVE WITH NITS, 3 bloccanti) — risolti il 2026-11-10

1. **Migration idempotente.** `CREATE POLICY` wrappata in DO block con check
   su `pg_policies` (pattern 008/015); funzione `CREATE OR REPLACE`,
   trigger `DROP IF EXISTS` + `CREATE`. Verificata con due applicazioni
   consecutive via psql (`-f` ×2, entrambe OK); commento corretto.
2. **Scrittura limitata a `read_at` — scelta (a) trigger.** La policy da sola
   lasciava self-spoof su titolo/corpo/data delle proprie righe. Ora
   `trg_restrict_push_notifications_update` (BEFORE UPDATE) accetta solo
   modifiche a `read_at`, resto → `P0001`. Casi 27d/27e in
   `tests/rls/assertions.sql` (title e user_id bloccati, proprietario
   invariato). Nessun flusso esistente scrive altre colonne (002 solo
   INSERT, app solo `read_at`).
3. **Href per kind.** `karma_loss` porta `lobby_id` ma apriva la lobby:
   ora karma/ban → `/profile` ("Apri profilo", prototipo); solo i tipi
   lobby usano `lobby_id` (court → `/courts/<uuid>`, senno `/lobbies`);
   checkin/meteo/neutral → `/courts/<uuid>` se `court_id` valido, senno
   `null`. Test con shape reali di 002. Live: riga karma mostra
   "Apri profilo".
- Nit: niente `preventDefault` con modificatori (navigazione nativa, resta
  non letta); `loadMore` filtra `seenIds` (offset shiftato dal prepend);
  `void removeChannel`.
- Riverifica: vitest 143/143, lint/tsc/lint:design verdi, test:rls exit 0,
  live completo verde + console pulita, axe autenticata 0 violazioni,
  suite a11y 3/3 (run precedente, pagine non toccate da questo round).
