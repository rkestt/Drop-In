---
id: t10
type: task
hitl: false
claimed: false
blocked_by: [t8, t9]
---
## Question

Implementa loop per far diventare verdi i test di t8/t9 — **non toccare i test**, solo codice.

**Da fare:**
- crea `lib/karma.ts`, `lib/lobby.ts`, `lib/checkin.ts`, `lib/validation.ts` con funzioni pure che soddisfano i test
- estendi `lib/geo.ts` con `haversineDistance` + `isWithinRadius` (usa formula haversine, no dipendenze)
- DB: aggiungi trigger `enforce_lobby_capacity` (se `participants_count >= max_players` → RAISE EXCEPTION), opzionale clamp `max_players` check
- fix `create-lobby-sheet` + `lobby-card`: sostituisci `window.location.reload()` con `router.refresh()` (ponytail: 1 riga), usa `lib/lobby` per validazione client + `lib/validation` per startTime/maxPlayers, fix `includes("distance")` case-insensitive
- `check-in-sheet`: usa `lib/checkin` per `isAccuracyOk`, aggiungi `ALLOW_MOCK_GPS` (se `process.env.NEXT_PUBLIC_ALLOW_MOCK_GPS==="true"` usa `courtLat/courtLng` invece di `navigator.geolocation`) così E2E non ha bisogno di GPS reale

Chiusura quando `vitest 13+nuovi` tutti verdi, `t8/t9` non modificati, `npm run lint && tsc` verdi.

## Resolution

(TBD)
