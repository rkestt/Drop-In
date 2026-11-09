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

## Resolution

(TBD — chiudere con: route, stati verificati, esito realtime, trigger capacità, screenshot, spec.)
