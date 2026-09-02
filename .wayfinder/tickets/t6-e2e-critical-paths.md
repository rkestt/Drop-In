---
id: t6
type: task
hitl: false
claimed: false
blocked_by: []
---
## Question

E2E percorsi critici + fix errori runtime — migrato da taskman `e2e-critical-paths` (2026-08-23).

Percorsi:
- `tests/e2e/smoke.spec.ts` — homepage map + lobby + zero console errors
- `tests/e2e/browse.spec.ts` — seeded courts su map + panning viewport refetch
- `tests/e2e/court-detail.spec.ts` — court detail + unknown id 404

Stato 2026-09-02: 5/5 verdi dopo fix `console.ts` 404 ignore, supabase 200 courts, build verde con `env -u NODE_ENV`. Verificare `npm run test:all` full gate e chiudere ticket.

## Resolution

(TBD — chiudere quando `npm run test:all` = lint 0 + tsc 0 + vitest 13/13 + playwright 5/5 verde su supabase up)
