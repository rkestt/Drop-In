---
id: t7
type: task
hitl: false
claimed: false
blocked_by: [t6]
---
## Question

Sweep completa route rimanenti, PWA, gate finale — migrato da taskman `full-app-sweep-fixes` (2026-08-23).

Scope:
- route `(dashboard)/lobbies`, `(dashboard)/profile`, `courts/[id]` edge cases (già parzialmente coperto)
- PWA `app/sw.ts` → `public/sw.js` serwist verificato (build prod `env -u NODE_ENV`)
- Realtime lobbies, check-in GPS 50m mock, karma/ban UI
- Gate finale `npm run test:all` + `npm run build` verdi

Dipende da t6 E2E critici.

## Resolution

(TBD)
