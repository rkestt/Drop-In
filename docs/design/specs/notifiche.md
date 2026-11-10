# Spec — Centro notifiche

Implementazione del prototipo `docs/design/prototypes/notifications.html`
(approvato HITL 2026-11-10, vincolante per copy, gerarchia e stati).
I frame 1–2 del prototipo (permesso push / negato) sono **futuro** e restano
fuori scope: nessun `Notification.requestPermission()`, nessun testo che
prometta notifiche di sistema. Etichetta usata: "Avvisi dell'app".

## Obiettivo

Vedere gli avvisi dell'app in ordine di arrivo, capire al volo quali sono
da leggere, aprire il campo o la lobby collegata con un tap.

## Route e file

- `app/(dashboard)/notifications/page.tsx` — server, auth guard (redirect
  login con `next`), prima pagina (20 righe, `sent_at desc`).
- `components/notifications/notification-list.tsx` — client: lista,
  paginazione, segna-come-letta, realtime, stati.
- `components/notifications/notification-item.tsx` — riga: icona per tipo,
  titolo, corpo, ora relativa, pallino non letta, link.
- `components/notifications/notification-bell.tsx` — campanella con badge
  reale, montata sull'overlay mappa (alto-destra) e nell'header `(dashboard)`.
- `lib/notifications/link.ts` — puro: `data` JSONB → href (`notificationHref`),
  tipo icona (`notificationKind`), ora relativa (`formatRelativeTime`).
- Migration `016_notification_read.sql`: policy UPDATE own rows + tabella
  nella publication `supabase_realtime`.

## Stati

- **Default / lette:** barra con badge (`N non lette` accent, `Tutte lette`
  default) + `Segna tutte come lette`; righe non lette con pallino, titolo
  bold, `sr-only` "Non letta".
- **Tap riga con link:** optimistic `read_at` con rollback + toast su errore,
  poi naviga (`/courts/<uuid>`, o `/lobbies` se solo `lobby_id`).
- **Tap riga senza link** (`data` malformato): resta sulla pagina, segna come
  letta, mostra il dettaglio nel corpo. Mai errori, mai navigazioni a vuoto.
- **Realtime:** nuova riga in testa con flash accent 2s + un solo toast
  Sonner per id (deduplicato); annuncio via live region `aria-live="polite"`.
- **Vuoto:** icona campanella, `Nessuna notifica` /
  `Ti avvisiamo qui quando cambia qualcosa.` + secondaria `Vai al profilo`.
  (Il prototipo rimandava al frame futuro Permesso: la secondaria punta al
  profilo finché il delivery push non esiste.)
- **Errore caricamento:** `Non riusciamo a caricare le notifiche.` /
  `Controlla la connessione e riprova.` + `Riprova` (reload).
- **Offline:** banner `Dati di N min fa` + `Sei offline. Segnare come letta
  richiede la connessione.`; righe non interattive, niente segna-come-letto.
- **Paginazione:** `Carica altre` (20 per pagina), errore inline + Riprova.

## Deep link (scostamento dal ticket)

Il ticket prevedeva `lobby_id` → `/lobbies/<uuid>`, ma la route dettaglio
lobby non esiste (solo lista `/lobbies`): un href lì darebbe 404. Scelta:
`court_id` valido → `/courts/<uuid>`; solo `lobby_id` valido → `/lobbies`
(lista). Quando nasce il dettaglio lobby, basta cambiare `notificationHref`
(il test `notifications-link.test.ts` fissa il contratto attuale).

## A11y

- Non letta non solo colore: pallino + peso titolo + `sr-only` "Non letta".
- Badge campanella con nome accessibile `Notifiche, N non lette`.
- Toast realtime `aria-hidden`-equivalente (Sonner): l'annuncio passa dalla
  live region della lista.
- Target ≥ 44px (righe, bottoni, campanella 44px); focus ring 2px accent.
- `prefers-reduced-motion`: regola globale in `globals.css`, il flash è
  decorativo.

## Verifica

- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npx vitest run`,
  `npm run test:rls` verdi.
- `npm run test:a11y` verde (suite esistente; `/notifications` richiede
  sessione, verificata live con screenshot 360/768).
