# Full app sweep + gate finale

## Perché
Chiusura del "100%": nessuna route senza test, PWA/offline verificati, unico comando goal.

## Cosa copre (ciò che e2e-critical-paths NON tocca)
1. **Profile** — `(dashboard)/profile`: visualizzazione, edit-profile-sheet (nickname update), persistenza.
2. **Offline/PWA** — service worker registra in prod build (`next build && next start`), offline-fallback appare offline, cache map-tiles non esplode. Test Playwright con `context.setOffline(true)`.
3. **Push notifications degradato** — push-provider è no-op stub noto: testare che l'app NON crashi e toast provider regga. FIX VAPID end-to-end FUORI scope → voce finale in RUNTIME_ISSUES.md come needs-product-decision.
4. **Zero-console-error sweep** — spec trasversale che visita OGNI route dell'app (lista da `find app -name "page.tsx"`) raccogliendo console errors/warnings; gate = zero errori.
5. **Middleware auth** (`middleware.ts`, `lib/supabase/middleware.ts`) — refresh sessione, redirect.

## Gate finale del loop
- `npm run test:all` (= lint + tsc + vitest + playwright) → exit 0.
- `npm run build` pulito.
- RUNTIME_ISSUES.md: ogni issue trovata ha stato fix|documented.
- README/AGENTS.md: aggiornare sezione comandi con test:all (surgical).

## Precondition
Route list per lo sweep — Proof: `find app -name "page.tsx" | sort` al momento dell'esecuzione (oggi: 4 page.tsx). Se nuove route appaiono, includerle.

Nessuna rimozione simboli prevista; eventuali fix distruttivi durante lo sweep seguono la regola proof-consumer del piano E2E.