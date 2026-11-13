# Phase 2.5 — Bugfix staging (post Phase 2)

Nata dai test manuali su stage il 2026-11-13. Non è una fase di feature: chiude i bug che rendono la UI fuorviante o rotta prima di andare avanti con Phase 3.

## Ticket

| # | Area | Cosa | Criterio di uscita |
|---|---|---|---|
| 76 | courts | Niente check-in/lobby su corti pending; mostrare "In attesa di approvazione" | Corte pending non mostra CTA operative; errore P0001 specifico; test e2e |
| 77 | lobby | Messaggio corretto quando la lobby è chiusa (non "riprova") | Join su lobby closed → "Lobby chiusa"; niente retry loop |
| 78 | lobby | React hydration error #418 | Dev non minificato senza mismatch; e2e console pulita |
| 79 | map | Warning MapLibre su valori null | Nessun warning `Expected value to be of type number` in console |
| 74 | auth | Toggle mostra/nascondi password login+registrazione | Occhio accessibile, valore invariato, mobile 44px |

## Metodo

- Un ticket alla volta, TDD dove c'è un seam puro (`lib/checkin/errors.ts`, `lib/datetime.ts`, `lib/lobbies/join-errors.ts`, `lib/map/style-guards.ts`).
- `@oracle` review per i diff non banali; `@tester` live per la UI.
- Gate: `npm run test:all` (lint, lint:design, tsc, vitest, test:rls, playwright e2e) + retest stage.
- Aggiornare `docs/roadmap.md` e chiudere i ticket con evidenza.

## Note di causa (recon 2026-11-13)

- **#78**: `formatDay`/`formatTime` in `components/lobby/lobby-detail.tsx` e `lobby-card.tsx` usano `toLocale*` **senza `timeZone`**: il server (UTC su Vercel/CI) e il browser (Europe/Rome) producono testi diversi per lo stesso `start_time`. Precedente già risolto per il check-in in `lib/checkin/errors.ts` (`APP_TIME_ZONE`). Serve un helper unico, non un mount-guard.
- **#77**: `confirmJoin` non controlla `lobby.status`; l'errore del trigger (P0001 "chiusa/scaduta") viene classificato `permanent` da `classifyOutboxError` e mostrato **grezzo** all'utente. Manca la distinzione "lobby chiusa" vs guasto.
- **#76**: la pagina carica `moderation_status` (`select("*")`) ma il tipo locale lo scarta; CTA renderizzate senza gate. `fromInsertError` non riconosce "campi approvati" → messaggio generico.
- **#76 deep link**: il trigger `require_approved_court_lobbies` (012, `BEFORE INSERT ON lobbies`) vieta di creare lobby su corti non approvate, **anche via service role**. Il caso reale è quindi una corte declassata dopo: la fixture e2e (`tests/e2e/lobby-pending.spec.ts`) crea corte `approved` + lobby, poi porta la corte a `pending`. Le lobby restano leggibili ("viewable by everyone", 001), quindi il deep link arriva alla pagina e il gate `courtApproved` deve chiudere join e crea-lobby lasciando funzionare l'uscita.
- **#79**: il warning nasce dalle filter del **style Liberty** (OpenFreeMap) con confronti d'ordine su `rank`/`admin_level`/`ref_length`: i feature privi del campo valgono `null` e MapLibre logga via `Assertion.evaluate`. Lato app vanno comunque validati `lat/lng` finiti e corretto il cast `customAttribution` (`MAP_ATTRIBUTION as unknown as string`).

## Esito (2026-11-13)

| # | Fix | Prova |
|---|---|---|
| 76 | Copy per stato (`pending`/`rejected`/`duplicate`/altro), CTA operative nascoste, gate su `/lobbies/[id]` via `courtApproved`, mappa P0001 "campi approvati" → "Campo non approvato" senza retry | unit `checkin-errors` (20), e2e `court-pending.spec.ts` (owner, anon, rejected), e2e `lobby-pending.spec.ts` |
| 77 | `lib/lobbies/join-errors.ts`: chiusa/in corso/piena/duplicato/transient; mai messaggi DB grezzi; "Riprova" solo se ritentabile; stato ottimistico sempre rollback | unit `lobby-join-errors` (15), e2e offline-queue "join su lobby chiusa" |
| 78 | `lib/datetime.ts` unica fonte Rome-pinned (`formatToParts`, `now` iniettabile), migrati lobby/court/profile/reports/history/notifiche; ban gate mount-guarded | unit `datetime` e affini, e2e `hydration.spec.ts` su `/`, `/lobbies`, `/lobbies/[id]`, `/courts/[id]`, `/profile` (server UTC, browser Rome) |
| 79 | `lib/map/style-guards.ts` (guardia idempotente sui confronti d'ordine), coordinate non finite filtrate, `customAttribution` corretto; causa in `docs/map.md` | unit `map-style-guards` (11), e2e `map-console.spec.ts` |
| 74 | Toggle occhio 44×44 in login e registrazione, nome accessibile che cambia, valore/focus conservati | e2e `password-toggle.spec.ts` (360 px + modalità registrazione), axe già in `a11y.spec.ts` |

Gate locale: `npm run test:all` **verde** (exit 0; lint, lint:design, tsc, 440 unit, test:rls, e2e 35 eseguiti + 23 skippati senza DB) e giro completo `E2E_WITH_DB=1` verde su 58/58. Verifica di regressione #78: con la vecchia `lobby-detail.tsx` il test di idratazione fallisce su `/lobbies/[id]`. Issues #74, #76, #77, #78, #79 chiuse con evidenza. Resta il retest su stage: richiede commit + push del branch `stage` + `npm run stage:alias` (passo di release, non fatto qui).

## Non in questa fase

- Nuove feature Phase 3 (i18n, admin, ratings, share).
- Deploy prod.
- Audit dati #63 (progetto separato).
