---
id: t11
type: task
hitl: false
claimed: false
blocked_by: [t10]
---
## Question

E2E Playwright loop vero con mock GPS — verifica loop chiuso come utente reale.

**Da fare (tests/e2e/):**
- `loop.spec.ts` — usa `NEXT_PUBLIC_ALLOW_MOCK_GPS=true` + supabase `createClient` per creare 2 utenti fake (signUp via `supabase.auth.signUp` o via `docker exec psql` insert), poi:
  1. utente A `goto /courts/<id>` → crea lobby (future startTime, max 4) → verifica appare in `/lobbies` tab mine
  2. utente B join lobby → verifica participants 2/4
  3. utente A check-in mock → verifica `karma 91` e `push_notifications` + UI `KarmaIndicator`
  4. chiudi lobby (update status closed via supabase) senza check-in di B → verifica B `karma 87` (-3) e se <50 `banned_until` settato
  5. verifica `ban-banner` visibile e `create-lobby` bloccato per bannato

Deve girare headless su `localhost:3100` con `supabase` up, `ALLOW_MOCK` attivo, `trackConsoleErrors` pulito. Usa `trace` per debug.

Chiusura quando `playwright` 6+ test verdi, map pronta per prod.

## Resolution

(TBD)
