<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Heed deprecation notices. Check installed Next.js version in `node_modules/next/package.json` before relying on cached knowledge.
<!-- END:nextjs-agent-rules -->

# Dev Workspace Preferences
- Inherit Global User Preferences & Caveman Execution.
- Focus: Fullstack execution, rapid feature delivery, strict type safety, offline-first architectures.

# Tech Stack Constraints (Strict)
- Next.js 15 (App Router): explicit `use client` / `use server` directives on every file; strict null checks, no implicit `any`.
- Supabase: use generated types strictly (`lib/supabase/database.types.ts`); no manual overrides; migrations tracked in `supabase/migrations/`.
- PWA (Drop-In Street Edition): prioritize bundle optimization, offline service worker, OSM tile caching.
- UI: Tailwind utility-first, atomic components (copy/paste over heavy npm packaging).

# Execution Guardrails
- Orchestrator delegates, does not implement: @fixer implements, @oracle reviews, @tester verifies live (read-only, never touches code), @designer owns UI/UX.
- Before modifying a shared table or shared state endpoint, check for architectural impacts via @oracle.
- If a UI change impacts layout consistency, call @designer. Mobile-first priority.
- UI changes: build/lint/typecheck/test green is not DONE. Always dispatch @tester on dev server (light/dark, reload, toggle, console/hydration errors, screenshots) before reporting done.

# Wiki LLM (progetto)
- Pre-flight obbligatorio: wiki_recall su vault progetto (`llm-wiki_*`) poi su globale (`llm-wiki-global_*`), progetto vince a parità; se <2 hit utili → wiki_search sui termini chiave. `wiki_status` va letto su entrambe le vault (quella risolta + globale), mai usato per concludere "wiki vuota".
- Scrivi insight stabili senza che l'utente lo chieda (trasversali → globale, progetto → progetto); 1 insight = 1 pagina atomica; mai scrivere a mano index.md/log.md/meta/**/raw/**.
- Questo file batte le regole globali nella pratica: il passo wiki qui sopra non va omesso.

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

- **Wayfinder** (`.wayfinder/`): **CANONICAL** — map `drop-in-next` attiva (ex `drop-in-bella-funzionante` chiusa 2026-08-23). Decision ticket + frontier, blocking via `blocked_by`, claim via `claimed`. Unico tracker per God.
- **Taskman** (`.taskman/plans/`): FROZEN — 4 piani 2026-08-23 (2 done, 2 in-progress migrati in Wayfinder t6/t7). Solo lettura/archivio, non usare per nuovi lavori.
- **Wiki** (`.llm-wiki/`): memoria durable (concept/entity/synthesis). `wiki_observe` per note, `wiki_retro` per insight atomici.
- **Quality gate unico**: `npm run test:all` = `npm run lint && tsc --noEmit && vitest run && playwright test` — deve essere verde prima di ogni commit harness-relevant.

## Agent skills

### Issue tracker

GitHub issues in rkestt/Drop-In. See `docs/agents/issue-tracker.md`.

### Triage labels

Default mattpocock labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.


