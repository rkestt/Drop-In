---
id: t7
type: task
hitl: false
claimed: true
blocked_by: [t6]
status: closed
closed_at: 2026-09-02
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

**Chiuso 2026-09-02 — sweep completa**
- middleware `updateSession` fix: protegge `/lobbies` + `/profile` oltre a `/dashboard` (route group mapping)
- PWA icons: generati `public/icon-192x192.png` (548B) + `icon-512x512.png` (1.9K) colore accent #ff6b35, manifest ok, sw.js 43K verificato
- realtime: canali `lobbies`, `profile-*`, `lobby-list`, `reported-courts` verificati in 5 componenti
- check-in: trigger `enforce_check_in_distance` 50m + `enforce_check_in_cooldown` 5min + karma ban presenti in DB
- gate finale: lint 0, tsc 0, vitest 13/13, playwright 5/5, build prod verde 460kB

