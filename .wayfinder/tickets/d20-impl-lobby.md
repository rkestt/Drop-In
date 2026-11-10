---
id: d20
type: impl
hitl: false
claimed: false
blocked_by: [d12, d5, d6]
---
## Question

**Obiettivo.** Implementare l'area lobby approvata in `d12`: lista con stati veri, dettaglio con deep link, creazione e join con conferma. Fine dei `window.location.reload()` e delle card che cambiano senza dirlo.

**Prerequisiti.** Prototipo `docs/design/prototypes/lobby.html` approvato (leggi la Resolution di `d12`). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `app/(dashboard)/lobbies/[id]/page.tsx` (nuovo): dettaglio lobby, `notFound()` se non esiste; dati reali.
- `components/lobby/lobby-detail.tsx` (nuovo): orario, campo, partecipanti, stato, CTA.
- `components/lobby/join-lobby-drawer.tsx` (nuovo): conferma con orario, posti, karma.
- `components/lobby/create-lobby-sheet.tsx` → `create-lobby-drawer.tsx`: drawer, validazione, errori di dominio.
- `components/lobby/lobby-card.tsx`: stati piena/in corso/chiusa, join ottimistico con rollback.
- `components/lobby/lobby-list.tsx`, `lobby-tabs.tsx`: empty state con CTA, conteggi, aggiornamento realtime.
- `app/(dashboard)/lobbies/page.tsx`: passa i dati necessari, niente fetch duplicati nel client.
- `docs/design/specs/lobby.md` (nuovo).

**Comportamento.**

- **Lista**: tab "Le tue"/"Vicine" con `aria-selected`; empty state con CTA ("Trova un campo" per "Le tue", "Crea una lobby" per "Vicine" se c'è un campo). Realtime su `lobbies` e `lobby_participants` aggiorna la lista senza reload.
- **Dettaglio**: raggiungibile a freddo; mostra nome campo (link), orario, `3/5`, stato, partecipanti (iniziali + nickname), requisito karma. Una sola CTA: "Unisciti" se aperta e non piena; "Esci" secondaria se sei dentro; nessuna CTA se piena/in corso/chiusa, solo il motivo.
- **Crea**: orario futuro, max 2–30, riepilogo; errori inline per "orario passato", "max fuori range", "bannato", "karma basso". Al successo: drawer chiuso, card nuova visibile in "Le tue" (refresh/realtime), nessun reload.
- **Join**: conferma; stato ottimistico "Sei dentro"; se il server rifiuta (piena, scaduta, già dentro) rollback + motivo + recovery ("Posti esauriti: crea la tua lobby").
- **Uscita**: "Esci" chiede conferma solo se la lobby è `in_progress`; altrimenti esegue.
- **Capacità**: non implementare la corsa solo nel client. Se il trigger `enforce_lobby_capacity` non esiste nel DB, **fermati** e apri un ticket DB (la map core-loop lo copre in t10): non aggiungere una seconda verifica solo lato client.

**Regole.**

- Un contenitore per pipeline: lista e dettaglio pagine, crea e join drawer. Mai drawer su drawer.
- Niente `window.location.reload()`: `router.refresh()` o stato realtime.
- Gli orari sono formattati `it-IT`; i posti `3/5`.
- Bannato/karma basso: il messaggio dice il motivo e la data/requisito, non "Operazione non riuscita".
- Una sola CTA primaria per schermata.

**Acceptance.**

- `/lobbies/<id>` funziona a freddo (link incollato in una nuova scheda) e con lobby inesistente mostra 404.
- Join: participants passa da `n` a `n+1` in UI e DB; se pieno, nessun incremento e messaggio corretto.
- Creazione: la lobby compare senza reload; orario e max sono quelli inseriti.
- Uscita: participants diminuisce; lo stato "Sei dentro" sparisce.
- Realtime: con due browser, join/leave si riflettono entro pochi secondi.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; E2E del loop (`t11`) non rotto.
- `@tester` verifica live 360/768 con screenshot e console pulita.

**Comandi di verifica.**

```bash
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
npx playwright test tests/e2e/loop.spec.ts   # se t11 è già in main
# manuale: crea lobby, join da secondo browser, uscita, lobby piena/chiusa
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (Crea lobby, Join lobby), `supabase/migrations/001_initial_schema.sql` (`lobbies`, `lobby_participants`), `docs/design/prototypes/lobby.html`.

## Issue GitHub collegate

Assorbite da questo ticket (dedup del Phase 1 review, PR #49):

- #57 `fix(rls): prevent court_id swap to pending courts in lobbies/check_ins
  UPDATE` (parte lobbies) — nessun `court_id` verso campi non approvati.
- #48 `fix: "Partite vicine" mostra lobby di tutta Italia` — lo scope delle
  lobby vicine deve usare il raggio.

**Nota da d7.** `components/lobby/lobby-card.tsx` ha già il badge "Sei dentro"
con `NextHighlight` ma **non è montato**: la lista reale è resa inline in
`components/lobby/lobby-list.tsx`. Quando si implementa la lista lobby (questo
ticket) il wiring va fatto lì, oppure il componente va eliminato se resta morto.

## Resolution

**Implementato il 2026-11-10 su `fix/d20-f3` (branch da HEAD di `design/1.5`).**

- **Route**: `app/(dashboard)/lobbies/[id]/page.tsx` + `not-found.tsx`.
  Dettaglio a freddo con dati reali; UUID invalido o lobby assente → 404
  dedicata ("Lobby non trovata" + "Torna alle lobby"); rete giù → messaggio
  + "Riprova" (mai 404 secco, regola d24). Anonimo → login con `next`.
  Le righe "Lobby attive" di `app/(app)/courts/[id]/page.tsx` linkano al
  dettaglio. `lib/notifications/link.ts`: le lobby ora puntano a
  `/lobbies/<uuid>` (test aggiornato).
- **LobbyCard**: CABLATA nella lista (scelta A). Riscritta presentazionale
  (link al dettaglio, badge Aperta/Al completo/In corso/Chiusa, `n/max`
  it-IT, "Sei dentro" con NextHighlight, "Unisciti ›"): niente più logica
  join/supabase/reload dentro la card.
- **Dettaglio**: drawer e non route? ROUTE creata (il ticket la chiedeva e
  il deep link da notifiche lo richiede). Mai drawer su drawer: la pagina
  apre un drawer alla volta (join oppure crea).
- **Stati verificati live (360 + 768, console pulita, axe senza violazioni
  sul dettaglio)**: lista tue/vicine con tab e conteggi, vuoto, loading,
  dettaglio aperta/piena (banner + crea)/in corso/chiusa (nota, niente CTA),
  crea con esito, join con conferma + ottimistico "Sei dentro" + uscita
  diretta (aperta) — vedi `/tmp/opencode/d20-*.png`.
- **Realtime**: canali su `lobbies` + `lobby_participants` in tab, vicine e
  dettaglio (con `filter` per id) → `router.refresh()`, mai reload.
  Zero `window.location.reload()` rimasti nell'area lobby.
- **Trigger capacità**: `enforce_lobby_capacity` NON esiste nel DB
  (verificato su `supabase_db_drop-in`). Come da ticket: nessuna
  migrazione creata (lo copre `t10-core-loop-impl`), nessuna verifica
  client sostitutiva. La UI disabilita il join a lobby piena (stato, non
  enforcement) e gestisce il rifiuto server con rollback + recovery.
  Gap noto: in caso di corsa, il DB accetta l'insert oltre capienza.
- **"Vicine"**: raggio 15 km con haversine client-side su lobby aperte
  (ordinate per distanza reale, bug #48 chiuso); senza posizione: messaggio
  + "Trova un campo"; senza lobby ma con campi: "Crea una lobby" sul campo
  più vicino (RPC `nearby_courts`, solo per la CTA).
- **Create**: `create-lobby-sheet.tsx` → `create-lobby-drawer.tsx`
  (stesso RHF + `createLobbySchema`, niente reload: `router.refresh()`).
- **Morti eliminati**: `lobby-list.tsx` (mai montato, logica spostata in
  `nearby-lobbies.tsx` con raggio), `leave-lobby-button.tsx` (logica in
  `lobby-detail.tsx`, con conferma inline solo se in corso).
- **Spec**: `docs/design/specs/lobby.md` (scostamenti: nessun requisito
  karma nel DB → drawer/dettaglio mostrano solo il tuo karma + no-show;
  stepper max giocatori non introdotto, resta l'Input RHF+schema).
- **Comandi**: `npm run lint` (0 errori, 1 warning pre-esistente in
  `scripts/check-design.mjs`), `tsc`, `lint:design`, `vitest` (188),
  `test:a11y` repo (3/3 su config 3118), Playwright d20 dedicato 3/3
  (lista/join/esci/404, redirect anonimo, crea-da-campo) con screenshot
  360/768 in `/tmp/opencode/d20-*.png`.
- **Scostamenti/ambientali** (per altri agenti): ① il DB locale è
  condiviso: un reset parallelo ha cancellato corte+lobby seedate a metà
  verifica — lo spec d20 è auto-provisioning (corte via RPC + lobby via
  API a runtime); ② con `NEXT_PUBLIC_SUPABASE_URL=/supabase` il server
  non vede la sessione browser (chiave cookie da `localhost` vs
  `127.0.0.1`): verifica fatta con dev su 3118 +
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, nessuna modifica ai
  file; ③ `notFound()` lancia: non va mai messo dentro un try/catch che
  lo ingoia (bug trovato e corretto nel dettaglio).
- **Round oracle (APPROVE WITH NITS, 2026-11-10).**
  - NaN raggio: `lib/lobbies/nearby.ts` puro e testato
    (`tests/unit/lobbies-nearby.test.ts`, 14 test: coordinate null/NaN →
    escluse, mai distanza indefinita). `NearbyLobbies` lo riusa (niente
    più haversine inline né `formatDistance` duplicato nella card).
  - Spec vs codice: allineata la spec alla verità (campione 100 lobby
    aperte + filtro raggio; RPC `nearby_courts` solo per la CTA di empty
    state) con limite dichiarato; courts-first scartata con motivazione
    (il cap del RPC tagliava le lobby vicine).
  - Realtime Vicine: ora efficace — gli eventi di canale richiamano
    `load()` con l'ultima posizione nota (non più `router.refresh()`
    inutile su un componente senza props server).
  - Minori: tablist con frecce + roving tabindex e `?tab=` riletto al
    cambio; aria-label card con sport e distanza; "Le tue" include
    `sport`.
