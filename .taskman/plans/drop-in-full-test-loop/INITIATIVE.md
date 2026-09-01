# Goal
Portare Drop-In a uno stato verificabile: infrastruttura test (Playwright + Vitest), inventario e fix di tutti i problemi runtime, gate finale "zero errori console su tutte le route + suite verdi".

# Piani (ordine rigido)
1. **test-infra-setup** — installare/configurare Vitest + Playwright, seed strategy Supabase locale, fixture auth/GPS, npm scripts. Base per tutto.
2. **vitest-unit-baseline** — unit su logica pura + `tsc --noEmit` pulito. Indipendente da E2E ma prima della sweep.
3. **e2e-critical-paths** — Playwright su flussi principali (browse mappa, court detail, auth, lobby CRUD, check-in/out GPS mockato, report). Fix errori trovati.
4. **full-app-sweep-fixes** — route rimanenti, PWA/offline, push stub degradato, gate finale zero-console-error su tutte le route.

# Definizione di "100%"
Non coverage %: tutte le route dell'app caricate senza errori console/SSR + tutti i flussi utente E2E verdi + unit verdi + build pulita. Il loop è `npm run test:all` come unico comando goal.

# Regole fix
- Fix surgicali, un errore alla volta, test che riproduce il bug prima del fix quando possibile.
- Fix distruttivi (rimozione simboli/file) richiedono proof dei consumer prima dell'azione.
- Push VAPID end-to-end FUORI scope (serve Edge Function); si verifica solo graceful degradation.