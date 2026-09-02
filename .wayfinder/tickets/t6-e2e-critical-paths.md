---
id: t6
type: task
hitl: false
claimed: true
blocked_by: []
status: closed
closed_at: 2026-09-02
---
## Question

E2E percorsi critici + fix errori runtime — migrato da taskman `e2e-critical-paths` (2026-08-23).

Percorsi:
- `tests/e2e/smoke.spec.ts` — homepage map + lobby + zero console errors
- `tests/e2e/browse.spec.ts` — seeded courts su map + panning viewport refetch
- `tests/e2e/court-detail.spec.ts` — court detail + unknown id 404

Stato 2026-09-02: 5/5 verdi dopo fix `console.ts` 404 ignore, supabase 200 courts, build verde con `env -u NODE_ENV`. Verificare `npm run test:all` full gate e chiudere ticket.

## Resolution

**Chiuso 2026-09-02 — gate verde verificato:**
- `npm run lint` 0 warnings
- `npx tsc --noEmit` 0
- `vitest` 13/13 (180ms)
- `playwright` 5/5 (20.2s) — fix `helpers/console.ts` ignora 404 notFound, supabase 200 courts up
- `build` verde `env -u NODE_ENV` (460kB, serwist ok)
- push `4d2df3c` + `0c1d16d` già su origin/master

Ticket completato, sblocca t7.
