# Drop-In — Roadmap & Feature Coverage

Last updated: 2026-11-05. Scope: Next.js 15 PWA + Supabase + MapLibre. Source of truth for what ships, what is partial, and what is missing. Companion to `README.md` and `AGENTS.md`.

## Coverage status

Legend: ✅ Shipped · 🟡 Partial · 🔴 Missing

### Core domain

| Feature | Status | Notes / gaps |
|---|---|---|
| Auth (email + Google OAuth) | ✅ | Supabase SSR; callback at `app/api/auth/callback`. |
| Browse-first (unauth map/courts) | ✅ | RLS courts SELECT true. |
| Map (OSM raster, MapLibre) | 🟡 | Hardcoded `ROME_CENTER`; eager import of `maplibre-gl` in `components/map/court-map.tsx` bloats initial bundle. |
| Court details | ✅ | Reports, lobbies, check-in, create lobby. |
| Lobbies (create/join/leave, realtime) | ✅ | Realtime channel on `lobbies`; auto-close +30min cron. |
| Check-in (GPS, 50m, cooldown 5min) | ✅ | Triggers enforce distance/cooldown; auto-checkout 2h. |
| Karma (start 90, +1 check-in, -3 no-show, ban <50 for 7d) | ✅ | `enforce_ban_on_low_karma`, `remove_expired_bans`. |
| Court reports (broken hoop, wet, lighting, occupied, other) | ✅ | Expiry + archive cron. |
| Profile (nickname, avatar, karma, ban banner) | 🟡 | Edit sheet exists; no avatar upload, no history view. |
| Push notifications | 🟡 | Subscriptions + DB triggers; no Edge Function delivery, no in-app notification center. |
| PWA offline (Serwist, tile cache 1200/7d) | 🟡 | Offline fallback page is generic; no offline queue for mutations; no update prompt. |

### UX / platform

| Feature | Status | Notes / gaps |
|---|---|---|
| Theming (dark/light) | 🔴 | Only light CSS vars in `globals.css`; no toggle, no `prefers-color-scheme`, no GitHub-dark palette. |
| Lazy-loaded map | 🔴 | `maplibre-gl` + CSS imported statically; no `next/dynamic` with `ssr:false`. |
| World-wide data | 🔴 | Seed is Rome-only (`scripts/extract_osm.py`, `seed_courts.sql`); no community submission flow; no global extraction. |
| i18n (Italian only) | 🔴 | Hardcoded Italian strings across components; no locale routing. |
| Accessibility audit | 🟡 | Some ARIA on map markers; no full audit, focus traps in sheets unverified. |
| Test coverage | 🔴 | No test framework; only `tsc --noEmit`. |
| Error boundaries / loading states | 🟡 | Per-page loading; no global error boundary or retry. |
| Court photos / media | 🔴 | No upload/storage bucket usage. |
| Search & filter courts | 🔴 | `limit(100)` fetch; no query, radius filter, or sport filter (venue/sport columns exist from migration 003). |
| Favorites / saved courts | 🔴 | No table or UI. |
| Install prompt (PWA) | 🔴 | Manifest present; no `beforeinstallprompt` handling. |
| Offline mutation queue | 🔴 | Check-in/lobby join fail offline; no retry. |
| Analytics / observability | 🔴 | `lib/logger.ts` only; no error tracking. |
| Moderation / admin | 🔴 | No admin routes or report triage UI. |
| Court verification / dedup | 🔴 | Community-submitted courts need review to avoid duplicates. |

## Proposed tickets (GitHub issue titles)

### Theme

1. `feat: dark/light theme toggle with GitHub-dark palette`
2. `feat: persist theme preference (localStorage + system) and apply via data-theme`
3. `feat: dark variants for MapLibre basemap and markers`

### Performance / bundle

4. `perf: lazy-load CourtMap with next/dynamic (ssr:false) and code-split maplibre-gl`
5. `perf: defer map tile style and reduce initial JS bundle`

### Data / world-wide

6. `feat: community court submission flow (add court with GPS + photo)`
7. `feat: global OSM extraction script with bbox/country params`
8. `feat: court dedup + moderation queue for community submissions`
9. `feat: nearby courts query by radius (PostGIS ST_DWithin)`
10. `feat: search and filter courts (name, surface, sport, distance)`

### Other gaps

11. `feat: court photos via Supabase Storage with thumbnails`
12. `feat: favorites / saved courts per user`
13. `feat: PWA install prompt (beforeinstallprompt) + update toast`
14. `feat: offline mutation queue with retry for check-in and lobby join`
15. `feat: in-app notification center + push delivery Edge Function`
16. `feat: user profile history (check-ins, karma events)`
17. `feat: avatar upload and crop`
18. `feat: i18n with next-intl (it/en) and locale routing`
19. `feat: accessibility audit fixes (focus traps, contrast, keyboard nav)`
20. `chore: add test framework (Vitest + Playwright) and CI`
21. `chore: global error boundary + retry + toast on failure`
22. `chore: error tracking integration (Sentry) and structured logging`
23. `feat: admin/moderation panel for courts and reports`
24. `feat: court ratings and reviews`
25. `feat: share court/lobby deep links and OG metadata`

## Suggested sequencing (phases)

- **Phase 0 (foundations):** #4 lazy map, #1/#2 theme, #20 tests, #21 error boundary.
- **Phase 1 (data growth):** #6 community submission, #7 global extraction, #8 dedup/moderation, #9 radius query, #10 search/filter.
- **Phase 2 (engagement):** #13 install prompt, #14 offline queue, #15 notifications, #16/#17 profile, #12 favorites.
- **Phase 3 (polish):** #3 dark map, #18 i18n, #19 a11y, #22 observability, #23 admin, #24 ratings, #25 sharing, #11 photos.

## Verification (definition of done for each ticket)

- Build: `npm run build` passes; `npm run lint` clean.
- Typecheck: `npm run typecheck` (tsc --noEmit) passes.
- Manual: feature works on mobile viewport (360px) and desktop; offline behavior documented where relevant.
- DB changes: new migration file under `supabase/migrations/` with RLS policies; `npx supabase db reset` succeeds.
- No regression: existing map/courts/lobbies/check-in flows still functional.
EOF
echo "written"