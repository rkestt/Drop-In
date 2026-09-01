---
type: source
title: "Observation: Fix GRANT mancanti su courts — smoke test rivela 42501"
tags:
  - supabase
  - rls
  - grant
  - anon
  - courts
  - smoke-test
status: observation
created: 2026-08-23
updated: 2026-08-23
slug: obs-2026-08-23-fix-grant-mancanti-su-courts-smoke-test-rivela-42501
relevance: high
observed_at: 2026-08-23T14:31:18.915Z
source_context: Smoke test browser post-wayfinder
---

# ⭐ Observation: Fix GRANT mancanti su courts — smoke test rivela 42501

Smoke test browser: dev server su 3000, REST RPC anon prima dava 42501 permission denied su courts. Causa: tabelle create senza GRANT SELECT per anon/authenticated, nonostante policy RLS su public. Fix: migrazione 005_grants_fix.sql fa GRANT SELECT su tutte le tabelle a anon+authenticated e INSERT/UPDATE/DELETE a authenticated. Dopo fix, REST RPC torna 2 courts e dump-dom headless mostra maplibregl-marker + "Spazio aperto" multipli. Screenshot headless resta bianco per limite WebGL/Swiftshader in CI, non bug app. Build+tsc ancora verdi.

*Relevance: high*
*Context: Smoke test browser post-wayfinder*
*Tags: supabase rls grant anon courts smoke-test*

---
*Observed: 2026-08-23T14:31:18.915Z*
