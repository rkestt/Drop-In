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

(TBD — chiudere con: migrazione, esito RLS, realtime, stati verificati, screenshot, spec.)
