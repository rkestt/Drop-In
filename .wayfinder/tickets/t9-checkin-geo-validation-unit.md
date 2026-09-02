---
id: t9
type: task
hitl: false
claimed: false
blocked_by: []
---
## Question

Unit test check-in, geo distance, validation — tdd red, parallelo a t8.

**Da creare (tests/unit/):**
- `geo-distance.test.ts` — pure `lib/geo.ts` esteso: `haversineDistance(Roma, 50m dentro/fuori)`, `isWithinRadius(court, user, 50)=bool`, già `bboxInside` ok
- `checkin.test.ts` — pure `lib/checkin.ts` (da creare): `isAccuracyOk(20)=true/21=false`, `isCooldownOk(lastCheckIn, now, 5min)=bool`, `isDistanceOk(distance, 50)=bool`
- `validation.test.ts` — pure `lib/validation.ts` (da creare): `isValidNickname`, `isValidReportCategory(broken_hoop|wet_court|lighting|occupied|other)`, `isFutureDate`, `isValidMaxPlayers`

Anche questi rossi prima di t10, poi freeze.

## Resolution

(TBD — chiudi quando `vitest` rosso sui nuovi file, commit solo test)
