# E2E critical paths + fix

## Perché
Il cuore del loop: riprodurre i problemi runtime dell'utente come test rossi, poi fixare fino al verde.

## Suite (tests/e2e/)
1. **browse.spec.ts** — mappa carica, courts visibili nel viewport seedato, pan/zoom trigger refetch, lobby list sulla home.
2. **court-detail.spec.ts** — `/courts/[id]`: dettagli court, check-in button state, report button.
3. **auth.spec.ts** — login modal: signup, login, logout, errore credenziali sbagliate. Route protette `(dashboard)` redirect se non auth.
4. **lobby.spec.ts** — create lobby (sheet), join, leave, tabs mie/pubbliche, validazioni input.
5. **checkin.spec.ts** — GPS mockato entro 50m: check-in ok, checkout, cooldown 5min blocca secondo check-in, distanza >50m fallisce con messaggio.
6. **karma.spec.ts** — indicatore karma visibile, ban banner se karma < 50 (seedare utente bannato via SQL fixture).
7. **report.spec.ts** — report sheet submit, reported-courts-indicator.

## Loop di lavoro per ogni suite
1. Scrivi test → run → cattura errori (console, network, SSR hydration).
2. Ogni errore = voce in `RUNTIME_ISSUES.md` (root o .taskman) con: sintomo, causa, fix applicato.
3. Fix chirurgico, ri-run finché verde. Test che riproduce il bug PRIMA del fix quando possibile.

## Vincoli
- Supabase locale + seed del piano infra. Dati di test isolati per spec (email uniche per run).
- Non mockare Supabase: E2E contro DB reale locale.
- Fix distruttivi: richiedono proof consumer (`grep` su ogni simbolo rimosso) prima dell'azione; altrimenti block e report.

## Verification gate
- `npm run test:e2e` → tutte le suite verdi.
- `npm run build` → successo (hydration errors emergono in build/prod).
- RUNTIME_ISSUES.md aggiornato con ogni fix.

## STOP conditions
- Errori che richiedono decisioni prodotto (es. cosa deve fare push notifications) → documentare in RUNTIME_ISSUES.md come "needs product decision" e proseguire col resto.