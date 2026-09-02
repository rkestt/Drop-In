# Wayfinder Map — drop-in-core-loop [ATTIVA]

## Destination

Loop chiuso verificato: utente crea lobby → join → check-in (anche mock in dev) → karma +1 / -3 e ban <50 funzionano, lobby non bucabile se piena/bannato, gate `test:all` verde con TDD (unit prima, poi codice, poi E2E). Pronto per prod.

## Notes

- Dominio: basket Roma — courts, lobby, check-in 50m, karma 90, ban 7d se <50, pg_cron auto-close.
- Skill: `wayfinder`, `tdd` (red→green, test a seam), `diagnosing-bugs`, `research` per trigger, `impeccable` se tocchi UI.
- Regola TDD di questa map: **test prima, poi codice** — i file `tests/unit/*.test.ts` scritti in t8/t9 non si toccano più in t10/t11.
- Tracker: `.wayfinder/tickets/` locale, `blocked_by` blocking, `claimed` claim, frontier = open+unblocked+unclaimed.
- Stato: `drop-in-next` chiusa 2026-09-02 (t6/t7). Questa è nuova map.

## Decisions so far (map precedenti)

- [t3-map-query](tickets/t3-map-query.md): viewport PostGIS RPC `courts_in_viewport`, bboxInside cache, zoom<10 skip.
- [t4-lobbies-scope](tickets/t4-lobbies-scope.md): `LobbyTabs` mine (creator/participant) vs nearby (open).
- [t5-push-scope](tickets/t5-push-scope.md): push deferito, trigger dormienti.
- [t6-e2e-critical-paths](tickets/t6-e2e-critical-paths.md) ✅ 2026-09-02 — lint0 tsc0 vitest13/13 playwright5/5, fix 404 ignore.
- [t7-full-app-sweep-fixes](tickets/t7-full-app-sweep-fixes.md) ✅ 2026-09-02 — middleware /lobbies+/profile, PWA icons 192/512, sw 43K.

## Tickets aperti (frontier)

- [t8-karma-lobby-unit](tickets/t8-karma-lobby-unit.md) — Unit test karma e lobby (pure domain, tdd red)
- [t9-checkin-geo-validation-unit](tickets/t9-checkin-geo-validation-unit.md) — Unit test check-in, geo distance, validation (tdd red)

## Tickets bloccati

- [t10-core-loop-impl](tickets/t10-core-loop-impl.md) — Implementa loop per far diventare verdi t8/t9 (blocked_by t8,t9)
- [t11-e2e-loop](tickets/t11-e2e-loop.md) — E2E Playwright loop vero con mock GPS (blocked_by t10)

## Not yet specified

- Dettaglio UI karma toast dopo -3/+1 (già in notification-toast, verificare)
- Balancing karma: +1 è poco? -3 giusto? → per map successiva

## Out of scope

- Deploy prod, OSM 10k full, push delivery, pagamenti — non in questo loop
