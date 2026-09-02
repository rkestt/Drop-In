---
id: t8
type: task
hitl: false
claimed: false
blocked_by: []
---
## Question

Unit test karma e lobby — tdd red, **scrivi prima, poi non toccare più**.

**Da creare (tests/unit/):**
- `karma.test.ts` — pure `lib/karma.ts` (da creare): `karmaAfterCheckIn(90)=91 clamp 100`, `karmaAfterNoShow(90)=87`, `isBanned(49)=true/50=false`, `banUntil(49)=now+7d`, `canCreate({banned_until:future})=false`, `canJoin({karma:49})=false`
- `lobby.test.ts` — pure `lib/lobby.ts` (da creare): `isLobbyFull(10,10)=true`, `validateMaxPlayers(1)=false/31=false/10=true`, `validateStartTime(past)=false/future=true`, `canJoinLobby({isFull, isBanned, karma})`

Questi test devono fallire (red) prima di t10. Non toccarli dopo t10 — il codice deve adattarsi a loro.

## Resolution

(TBD — chiudi quando `vitest run` mostra i nuovi test rossi, commit con solo test)
