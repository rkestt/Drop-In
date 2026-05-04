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
npm run dev          # Next.js dev server
npm run build        # Production build (output: standalone)
npm run lint         # ESLint (next/core-web-vitals + typescript config)
npx supabase start   # Local Supabase (ports: API 54321, DB 54322, Studio 54323)
npx supabase db reset # Apply migrations + seed
```

No test framework configured. No typecheck script — use `tsc --noEmit` manually if needed.

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

## OpenSpec

OpenSpec docs in `openspec/`. Use `openspec` CLI for change management. Config: `openspec/config.yaml` (schema: spec-driven).
