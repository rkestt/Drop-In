# Wayfinder Map — drop-in-next [ATTIVA]

## Destination

Drop-In pronto per sviluppo continuativo: E2E critici verdi (browse, smoke, court-detail), build prod verde, sweep route rimanenti + PWA verificato, gate `test:all` verde. Base solida per feature prodotto successive.

## Notes

- Dominio: basket di strada Roma — courts, lobby, check-in GPS 50m, karma 90, reports, push deferito.
- Skills preferite: `wayfinder` (questa map), `tdd`, `diagnosing-bugs`, `impeccable` per UI, `code-review` prima di merge, `llm-wiki` per memoria.
- Tracker: `.wayfinder/tickets/` locale markdown. `blocked_by` = blocking, `claimed` = claim. Frontier = open + unblocked + unclaimed.
- Stato recon: `context.md` + `HARNESS_REPORT.md` + `ARSENAL_REPORT.md`.
- Storico: ex map `drop-in-bella-funzionante` chiusa 2026-08-23 — vedi Decisions so far sotto.

## Decisions so far (da map precedente, chiusa 2026-08-23)

- [t3-map-query: viewport PostGIS](tickets/t3-map-query.md): mappa carica solo courts nel bbox via PostGIS RPC `courts_in_viewport`.
- [t4-lobbies-scope: due tab](tickets/t4-lobbies-scope.md): 'Le tue lobby' + 'Aperte vicine'.
- [t5-push-scope: deferito](tickets/t5-push-scope.md): push UI disattivata, trigger DB dormienti.

## Esecuzione precedente ✅

- [t1-build-green](tickets/t1-build-green.md) ✅ build/tsc/lint verdi
- [t2-env-seed](tickets/t2-env-seed.md) ✅ runtime up, 10130 courts seeded (ora dev 200)
- [t3-map-query](tickets/t3-map-query.md) ✅ RPC `courts_in_viewport` + fetch bbox moveend
- [t4-lobbies-scope](tickets/t4-lobbies-scope.md) ✅ due tab lobby
- [t5-push-scope](tickets/t5-push-scope.md) ✅ stub dormiente

## Tickets aperti (frontier)

- [t7-full-app-sweep-fixes](tickets/t7-full-app-sweep-fixes.md) — Sweep completa route rimanenti, PWA, gate finale (blocked_by t6 ora sbloccato)

## Chiusi in questa map

- [t6-e2e-critical-paths](tickets/t6-e2e-critical-paths.md) ✅ 2026-09-02 — lint 0, tsc 0, vitest 13/13, playwright 5/5, build verde

## Not yet specified

- Check-in GPS 50m UX dev senza GPS reale (mock/fixture)
- Verifica PWA/service worker serwist in prod
- Realtime lobbies Supabase Realtime

## Out of scope

- Nuove feature prodotto oltre gate verde (karma ban flow, push delivery, OSM extract prod 10k — per map successiva)
