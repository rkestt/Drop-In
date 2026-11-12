---
type: source
title: "Decisione: `sport IS NULL` = \"non specificato\", visibile con qualunque filtro sport"
slug: sport-null-visibile-con-qualsiasi-filtro
status: insight
category: "concepts"
created: 2026-11-12
updated: 2026-11-12
---

# Decisione: `sport IS NULL` = "non specificato", visibile con qualunque filtro sport

# Decisione: `sport IS NULL` = "non specificato", visibile con qualunque filtro sport

## Contesto
Il filtro sport (default `basketball`) nascondeva ogni corte con `courts.sport IS NULL`: su staging **6.364 corti su 10.131** (63%), quindi aprire l'app con il filtro di default mostrava una mappa quasi vuota senza spiegazione. Il dato manca perché l'import OSM non popola lo sport per la maggior parte dei campi.

## Decisione (2026-11-12, #71/#72)
NULL non significa "un altro sport": significa **sport sconosciuto**. Si è scelto di renderlo **visibile con qualunque filtro** e di dirlo esplicitamente nella UI con l'etichetta "Sport non specificato" (lista risultati e card lobby). È un default temporaneo: il backfill dei dati resta la strada giusta (#63).

## Perché non l'alternativa "solo con Tutti"
Era il comportamento corretto sul piano semantico ma inutilizzabile finché il 63% dei dati è incompleto: l'utente non ha modo di capire che il vuoto dipende dal dato e non dall'assenza di campi.

## Implementazione (tre punti che devono restare allineati)
1. **Tre RPC di lettura**, non una: `nearby_courts` (raggio), `open_lobbies` (raggio), `courts_in_viewport` (bbox) — `023_sport_null_visible.sql` aggiunge `c.sport IS NULL OR` al predicato sport di tutte e tre. Dimenticarne una produce un bug per superficie (mappa vs ricerca vs lobby).
2. **Client**: `sportMatches(null, qualsiasi) === true` in `lib/sport/sports.ts`.
3. **Copy**: `sportDisplayLabel()` in `lib/courts/search.ts` restituisce "Sport non specificato" per null/vuoto; usarla ovunque si mostri lo sport.

## Trappole incontrate
- Il test unit esistente asseriva la vecchia semantica (`sportMatches(null,"basketball") === false`): un cambio di semantica richiede di aggiornare i test che la fissavano, non solo di aggiungerne di nuovi.
- L'asserzione RLS su `courts_in_viewport` non può usare un bbox largo: la funzione non ha `ORDER BY` e taglia a `LIMIT 2000`, quindi la riga di fixture viene scartata in modo non deterministico. Serve un bbox stretto attorno alla fixture.
- `docs/rpc.md` e la gotcha in `AGENTS.md` dicevano l'opposto: la documentazione di semantica va aggiornata nello stesso commit della migrazione.

## Related
- `docs/rpc.md` (firme e semantica delle tre RPC)
- `docs/plans/phase2.md` (stato e numerazione migrazioni)
- `supabase/migrations/023_sport_null_visible.sql`
