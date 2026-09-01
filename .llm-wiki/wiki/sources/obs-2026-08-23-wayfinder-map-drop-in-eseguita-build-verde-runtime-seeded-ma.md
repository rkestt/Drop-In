---
type: source
title: "Observation: Wayfinder map Drop-In eseguita: build verde, runtime seeded, mappa viewport"
tags:
  - drop-in
  - wayfinder
  - orchestration
  - map-viewport
  - lobbies
  - push
status: observation
created: 2026-08-23
updated: 2026-08-23
slug: obs-2026-08-23-wayfinder-map-drop-in-eseguita-build-verde-runtime-seeded-ma
relevance: medium
observed_at: 2026-08-23T13:34:56.181Z
source_context: Executing wayfinder map drop-in-bella-funzionante
---

# 🔍 Observation: Wayfinder map Drop-In eseguita: build verde, runtime seeded, mappa viewport

Drop-In wayfinder map 'drop-in-bella-funzionante' fully executed. Final state: npm build + tsc + lint green (1 benign exhaustive-deps warning in app/(app)/page.tsx:155); Supabase local up with .env.local on ports 54321/54322 (studio/inbucket moved to 54333/54334 in config.toml to avoid collision with unrelated project 'relay'); 10130 courts seeded; migration 004_courts_viewport.sql adds RPC courts_in_viewport(min_lng,min_lat,max_lng,max_lat,max_results=2000) using && bbox overlap on GIST-indexed location column, verified 2000 rows / 17ms; app/(app)/page.tsx fetches courts per-viewport on moveend with skip-if-covered logic; lobbies page has two tabs via components/lobby/lobby-tabs.tsx ('Le tue lobby' filtered by user, 'Aperte vicine'); push notifications deferred — PushNotificationProvider is unmounted dead code, DB triggers dormant, documented in ticket t5. eslint.config.mjs ignores extended with .agents/** and supabase/.temp/**.

*Relevance: medium*
*Context: Executing wayfinder map drop-in-bella-funzionante*
*Tags: drop-in wayfinder orchestration map-viewport lobbies push*

---
*Observed: 2026-08-23T13:34:56.181Z*
