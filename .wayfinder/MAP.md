> **FROZEN — ARCHIVIO 2026-08-23** — Map chiusa, destinazione raggiunta. Non usare per nuovi lavori. Canonical tracker ora `taskman` (`.taskman/plans/`). Questo file resta solo lettura.

# Wayfinder Map — drop-in-bella-funzionante [FROZEN]

## Destination

App Drop-In builda, seedata e funzionante end-to-end: build verde, mappa mostra i courts reali (non 100), lobby coerenti, check-in testabile. Push notifications decise (reali o deferite) — non necessariamente implementate.

## Notes

- Dominio: app basket di strada Roma — courts, lobby, check-in GPS 50m, karma 90 start.
- Skills da consultare: `wayfinder`, `grilling` (ticket HITL), `diagnosing-bugs` se build esplode.
- **Override plan-don't-do**: task meccanici (install/build/fix config) si eseguono nel map stesso; decisioni di prodotto restano ticket.
- Tracker: locale markdown, `.wayfinder/tickets/`. Blocking in frontmatter `blocked_by`. Claim = campo `claimed`.
- Stato recon: `context.md` (radice repo).

## Decisions so far

- [t3-map-query: viewport PostGIS](tickets/t3-map-query.md): mappa carica solo i courts nel bbox visibile via PostGIS.
- [t4-lobbies-scope: due tab](tickets/t4-lobbies-scope.md): 'Le tue lobby' (per user) + 'Aperte vicine' (per distanza).
- [t5-push-scope: deferito](tickets/t5-push-scope.md): UI push disattivata, trigger DB dormienti, delivery posticipo.

## Tickets aperti

(nessuno — vedi Decisions so far)

## Esecuzione
- [t1-build-green](tickets/t1-build-green.md) ✅ build/tsc/lint verdi
- [t2-env-seed](tickets/t2-env-seed.md) ✅ runtime up, 10130 courts seeded
- [t3-map-query](tickets/t3-map-query.md) ✅ RPC `courts_in_viewport` (migrazione 004) + fetch bbox su moveend in app/(app)/page.tsx; query Roma 17ms, cap 2000, skip refetch se bbox coperto
- [t4-lobbies-scope](tickets/t4-lobbies-scope.md) ✅ due tab: lobbies/page.tsx + components/lobby/lobby-tabs.tsx
- [t5-push-scope](tickets/t5-push-scope.md) ✅ provider non montato = stub dormiente; commento documentazione aggiunto

## Gate finale (God)

build ✅ · tsc --noEmit ✅ · lint exit 0 (1 warning exhaustive-deps benigno) · migrazione 004 applicata · RPC verificata: 2000 courts in bbox Roma in 17ms · DB 10130 courts

## Not yet specified

- Check-in GPS 50m: UX dev/test senza GPS reale (dipende da t3/t4? no — dipende da product decision su testing mode).
- Verifica PWA/service worker post-fix serwist (dopo t1).
- Realtime lobbies (Supabase Realtime dichiarato nello stack, mai verificato in codice).

## Out of scope

- Nuove feature non presenti in openspec archive.


**STATUS: DESTINAZIONE RAGGIUNTA** — tutti i ticket chiusi, build/runtime/dati verificati end-to-end.
