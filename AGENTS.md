<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (PostgreSQL + PostGIS + pg_cron + Realtime)
- MapLibre GL JS for maps
- Serwist for PWA/service worker (`app/sw.ts`)

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build (output: standalone)
npm run lint         # ESLint (next/core-web-vitals + typescript config)
npx tsc --noEmit     # Typecheck (no emit)
npm run test:unit    # Vitest unit (tests/unit/)
npm run test:e2e     # Playwright E2E (tests/e2e/, baseURL http://localhost:3100)
npm run test:all     # lint + tsc + unit + e2e (gate finale)
npx supabase start   # Local Supabase (ports: API 54321, DB 54322, Studio 54333)
npx supabase db reset # Apply migrations + seed (200 courts Roma dev, 10k prod)
```

## Setup

1. `npm install`
2. `npx supabase start` — requires Docker
3. Copy Supabase URL/keys to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>`
4. `npx supabase db reset` — enables PostGIS + pg_cron, runs migrations

## Architecture

- `app/(app)/` — public pages (map, court details)
- `app/(dashboard)/` — authenticated pages (profile, lobbies)
- `app/api/auth/callback/` — Supabase OAuth callback
- `supabase/migrations/` — database schema (courts, profiles, lobbies, check_ins, reports)
- `scripts/` — OSM data extraction (`extract_osm.py`), seed SQL, deployment

## Gotchas

- **PostGIS required**: migrations fail without `CREATE EXTENSION postgis`
- **pg_cron enabled**: used for auto-checkout cron job (2h timeout, lobby close +30min)
- **PWA cache**: map tiles cached in "map-tiles" (500 entries, 30 day TTL)
- **Karma system**: starts at 90, -3 for no-show, ban <50 for 7 days
- **Browse-first**: unauthenticated users can view map/courts; auth required for lobbies
- **Route groups**: `(app)` and `(dashboard)` are folder conventions, not segments

## Harness — Tracker & Process (surgical, ponytail)

- **Taskman** (`taskman` CLI + `.taskman/plans/`): canonical per piani/initiative God. Unico writer per file, dipendenze via `depends_on`. Wayfinder/openspec non usati per esecuzione.
- **Wayfinder** (`.wayfinder/`): FROZEN — map `drop-in-bella-funzionante` chiusa 2026-08-23 (build verde, 10130 courts, viewport RPC). Solo lettura/archivio.
- **OpenSpec** (`openspec/`): ARCHIVIATO — `changes/archive/2026-05-01-drop-in-mvp/` (7 spec). Nessun change attivo. Riattivare solo per feature grandi con `openspec` CLI.
- **Wiki** (`.llm-wiki/`): memoria durable (concept/entity/synthesis). `wiki_observe` per note, `wiki_retro` per insight atomici.
- **Quality gate unico**: `npm run test:all` = `npm run lint && tsc --noEmit && vitest run && playwright test` — deve essere verde prima di ogni commit harness-relevant.
- **Canary (globale, sempre)**: ogni risposta inizia con `Andrea · tN · ctx ok` — incrementa N ogni turno, self-check onesto ok/aging/thin. Trip: 2 miss consecutivi o counter discontinuity → stop, checkpoint HANDOFF.md, re-anchor, reset t1 gen+1. Vedi `context-canary` skill.

## OpenSpec

OpenSpec docs in `openspec/`. ARCHIVIATO — vedi Harness sopra. Config: `openspec/config.yaml` (schema: spec-driven).
