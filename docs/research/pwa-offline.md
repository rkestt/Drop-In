# Offline-first PWA: Serwist + OSM tiles + Supabase (Next.js 15)

Research notes, 2026-10-30. Stack audited: `@serwist/next@9.5.10`, `maplibre-gl@5.24.0`,
`@supabase/ssr@0.10.2`, Next 15.1 (App Router, `output: standalone`).

## TL;DR

1. **The current tile cache is dead code.** `map-tiles` is never written: three independent bugs
   (route order, a regex that can't match the URL, never-reached ordering). Tiles land in the shared
   64-entry `static-image-assets` cache instead.
2. **OSM's tile policy forbids offline maps.** `tile.openstreetmap.org` explicitly bans prefetch and
   "save area for later". Caching tiles the user *viewed* is allowed and expected. A "download Rome
   for offline" button is a policy violation → self-host or use a provider that allows offline.
3. **`defaultCache` caches cross-origin responses** for 1 h (32 entries). Supabase REST calls are
   cross-origin → authenticated JSON can land in Cache Storage. Must be excluded explicitly.
4. **Supabase has no offline sync/conflict resolution.** You own the outbox. `BackgroundSyncPlugin`
   is a poor fit because it replays stale JWTs.
5. Map tiles are cheap per tile (~14 KB) but a city at z16 is ~2.7k tiles (~36 MB). Quota is not the
   problem; iOS 7-day eviction is.

---

## 1. Audit of `app/sw.ts` (current)

```ts
runtimeCaching: [
  ...defaultCache,
  { matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/, handler: new CacheFirst({ ... }) },
]
```

**Bug A — route order.** Serwist's router returns the **first** matching route
(`findMatchingRoute` iterates `this._routes` and returns on first `matchResult`,
`node_modules/serwist/dist/index.mjs:1819`). Because `...defaultCache` is spread **before** the tile
rule, the tile rule can never win. Both candidate default rules match a tile request:

```js
// 3rd entry in defaultCache, matched first — RegExp routes match the start of cross-origin URLs,
// and "https://tile.openstreetmap.org/14/8734/5952.png" starts with "https://"
{ matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
  handler: new StaleWhileRevalidate({ cacheName: "static-image-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 720 * 60 * 60, maxAgeFrom: "last-used" })] }) }
// and, further down, the catch-all
{ matcher: ({ sameOrigin }) => !sameOrigin, handler: new NetworkFirst({ cacheName: "cross-origin", ... }) }
```

Net effect: tiles *are* cached, but into `static-image-assets` — a 64-entry, LRU-by-last-used cache
shared with every app icon and SVG. Panning a map for ten seconds evicts the tiles you just loaded,
and it re-downloads them next time (directly against the OSM "keep a sufficient local cache" rule).
`map-tiles` is permanently empty.

**Bug B — the regex doesn't match the URL actually used.** The regex requires a subdomain
(`something.tile.openstreetmap.org`). `components/map/court-map.tsx` uses
`https://tile.openstreetmap.org/{z}/{x}/{y}.png` — no subdomain before `tile`, so `.*\.tile` never
matches. Even reordered, this rule would stay dead. Prefer host checks:
`({ url }) => url.hostname.endsWith("tile.openstreetmap.org")`.

**Bug C — CacheFirst + opaque responses.** `CacheFirst` only caches status 200 and drops opaque
(status 0) responses. `tile.openstreetmap.org` sends `access-control-allow-origin: *` and MapLibre
v5 fetches tiles via `fetch`/`createImageBitmap` (or `crossOrigin="anonymous"`), so responses are
CORS-readable 200s — *currently* fine, but it silently breaks the day someone sets
`crossOrigin` differently. Add `CacheableResponsePlugin({ statuses: [0, 200] })` as a safety net.

**Bug D — Supabase leak.** `lib/supabase/client.ts` talks to `NEXT_PUBLIC_SUPABASE_URL`
(`http://localhost:54321` locally, `https://<ref>.supabase.co` in prod) — cross-origin. Those
requests hit the `cross-origin` NetworkFirst cache: 32 responses, 1 h, including
`/rest/v1/*` payloads and `/auth/v1/token` bodies. Privacy bug + stale-permission bug.

**Bug E — auth pages are cached.** `defaultCache` caches `rsc`, `rscPrefetch` and `html` for
same-origin non-`/api/` paths, 32 entries each. `/profile` and `/lobbies` HTML/RSC payloads get
written to Cache Storage and are served by NetworkFirst on the next visit — including after logout.

**Also:** `next.config.js` disables Serwist when `NODE_ENV === 'development'`, so the SW only exists
after `npm run build && npm start`. Anything you "test" with `npm run dev` proves nothing.

**Also:** don't read `process.env.NEXT_PUBLIC_*` inside `app/sw.ts`. The SW is compiled by
`@serwist/webpack-plugin` in a separate compilation (`@serwist/next/dist/index.mjs:152+`), so Next's
`DefinePlugin` substitutions for public env vars are not guaranteed to be injected. Use literal
hostname matchers.

---

## 2. Caching strategy matrix

| Request class | Strategy | Cache name | maxEntries | TTL | Why |
|---|---|---|---|---|---|
| Precache (`__SW_MANIFEST`) | Precache | `serwist-precache-*` | all | revision-based | App shell, JS/CSS chunks |
| OSM raster tiles | `CacheFirst` (+`CacheableResponsePlugin [0,200]`, `purgeOnQuotaError`) | `map-tiles` | 800–1500 | 7 d on `maxAgeFrom:'last-fetched'` | Tiles are immutable-ish; policy requires ≥7 d. `last-fetched` stops re-download on every view (policy violation risk) |
| Static images/fonts | `StaleWhileRevalidate` | `static-image-assets` | 64 | 30 d | defaultCache |
| `_next/static` JS/CSS | `CacheFirst` / `SWR` | default | 64 | 24 h | content-hashed filenames |
| RSC + HTML (public routes only) | `NetworkFirst` | `pages*` | 32 | 24 h | offline navigation to visited routes |
| RSC + HTML for `/profile`, `/lobbies` | `NetworkOnly` | — | — | — | per-user data must never persist |
| Supabase `*.supabase.co` / `localhost:54321` | `NetworkOnly` | — | — | — | auth + PII |
| Everything else | `NetworkOnly` | — | — | — | defaultCache tail |

Rules: routes are matched **in registration order**, so exclusions go first, `defaultCache` last —
and the tile rule must be *before* the `.png` rule inside `defaultCache`, which is why prepending is
mandatory rather than cosmetic. `ExpirationPlugin.maxAgeFrom` defaults to `'last-fetched'`; use
`'last-used'` for assets you want evicted by popularity, `'last-fetched'` for tiles you must not
re-fetch (OSM policy).

`CacheFirst` refuses opaque responses; `StaleWhileRevalidate`/`NetworkFirst` accept 0 and 200.
Avoid `CacheOnly` for anything a user can navigate to: one bad install and the cache is permanently
stale with no recovery path except a new SW version.

---

## 3. The OSM tile policy constraint (hard blocker for "offline maps")

From the OSM Foundation Tile Usage Policy (fetched 2026-10-30, last modified 2026-10-29):

> **Offline use is not permitted on `tile.openstreetmap.org`.** Features such as "Download
> city/country for offline use" or "Save area for later" rely on prefetch/bulk downloading and are
> therefore prohibited.

> **Cache** tiles locally according to HTTP caching headers (or at least **7 days** if your cache
> cannot read them). […] Keep a sufficient local cache to ensure that repeat views do not
> unnecessarily re-download tiles.

> **Bulk downloading** is any pre-emptive fetching of tiles other than those a user is actively
> viewing. […] **Enforcement:** Prefetch/offline patterns […] will be **blocked without notice**.

> From web pages, ensure a valid **HTTP Referer** header is sent. Do not set a restrictive
> Referrer-Policy that prevents the `Referer` header being sent on requests to
> tile.openstreetmap.org.

Measured headers (`curl -I https://tile.openstreetmap.org/14/8734/5952.png`):

```
cache-control: max-age=16086, stale-while-revalidate=604800, stale-if-error=604800
content-type: image/png      content-length: 14002
access-control-allow-origin: *
```

Implications for Drop-In:

- **Allowed:** viewport-driven caching of tiles the user actually looked at, 7+ day TTL. That is
  exactly what the fixed `sw.ts` does.
- **Forbidden:** any "download this district" button, pre-seeding z12–z16 on first visit, background
  `sync` tile prefetch, `Range`-based bulk archive creation.
- **Referrer:** don't add a global `Referrer-Policy: no-referrer` in `next.config.js`.
- If real offline maps are a product requirement → **self-hosted tiles** or a paid provider with
  explicit offline terms. Options:
  - **PMTiles** single-file archive + `pmtiles://` protocol — one HTTP range-addressable file, works
    with MapLibre GL JS, best storage profile for offline (one blob instead of thousands of PNGs).
    `@makina-corpus/maplibre-offline-pmtiles` handles OPFS-backed offline downloads.
  - Self-hosted `tileserver-gl` / Martin for raster or vector.
  - Protomaps / MapTiler / Stadia — read the TOS: most allow offline only on paid tiers.

Storage math for central Rome (lon 12.35–12.65, lat 41.80–42.00), at ~14 KB/tile:

| zoom | tiles | size |
|---|---|---|
| z12 | 16 | 0.2 MB |
| z13 | 49 | 0.7 MB |
| z14 | 182 | 2.4 MB |
| z15 | 700 | 9.4 MB |
| z16 | 2 695 | 36 MB |
| z17 | 10 780 | 144 MB |

So a 500–1200 entry tile cache (~7–17 MB) covers roughly z14–z15 for one city — reasonable for
"recently viewed"; useless as a pre-seeded basemap. Storing a full city to z16 as raster PNGs
(~36 MB) is technically trivial but **policy-forbidden** on `tile.openstreetmap.org`.

---

## 4. Offline fallback

Serwist `fallbacks` is the supported mechanism (App Router example from the official docs):

```ts
new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  fallbacks: {
    entries: [
      { url: "/~offline", matcher: ({ request }) => request.destination === "document" },
    ],
  },
});
```

Requirements:

- `/~offline` must be **precached**, otherwise the fallback resolves to nothing. With
  `@serwist/next` add it to the build config:
  `additionalPrecacheEntries: [{ url: "/~offline", revision }]` (revision = git SHA or build hash).
- It must render **statically** — no `cookies()`, `headers()`, `searchParams`, no auth check.
  A dynamic offline page is a chicken-and-egg failure.
- Keep it dependency-light; it is the one page that must work when every fetch fails.
- `navigationPreload: true` + `NavigationRoute`/`navigateFallback` is the alternative; the
  `fallbacks` option is less error-prone because it doesn't shadow every navigation.
- Finer-grained alternative: `PrecacheFallbackPlugin({ fallbackUrls, serwist })` attached to a single
  strategy's `plugins` — lets the *map* route degrade to a "map unavailable offline" placeholder
  while the rest of the app still works.

Gotcha specific to this repo: offline navigation to `/profile` or `/lobbies` will hit
`middleware.ts` → `updateSession()` → `supabase.auth.getUser()` **on the server** — that's a
network call. When the origin is unreachable the SW serves the cached shell, but any RSC fetch or
refresh fails; the middleware should wrap `getUser()` in `try/catch` and fail open (treat as
"unknown session") rather than 500. Client-side route guards are the reliable layer; middleware is
a UX optimisation.

---

## 5. Supabase offline: you build the sync layer

Supabase docs are explicit — no built-in offline sync, no conflict resolution, developer implements
it (see `auth-anonymous` guide's `resolveDataConflicts` stub).

Read path:

- Cache the last successful `courts` / `lobbies` response in IndexedDB (or `localStorage` for small
  payloads), keyed by query, stamped `fetched_at`. Render stale + a "offline" badge.
- Courts are effectively static reference data (OSM imports) → `stale-while-revalidate` semantics
  are correct; a cached list older than a day is still fine for street basketball.
- Lobbies/check-ins are volatile → show last-known with an explicit staleness marker, never pretend.

Write path (check-in, report, create lobby):

- **Outbox in IndexedDB**, one record per pending mutation: `client_mutation_id` (`crypto.randomUUID()`),
  `table`, `op`, `payload`, `created_at`, `attempts`, `last_error`.
- Replay on `online` event + on app focus. Send **freshly signed** requests at replay time.
- **Idempotency:** `upsert(..., { onConflict: 'client_mutation_id' })` or a `unique` column, so a
  retried request cannot double-create. This is the single most important detail — networks fail
  *after* the server committed.
- **Conflict policy:** last-write-wins on a server-side `updated_at = now()` (never trust a client
  clock). For check-ins/lobbies LWW is fine; for anything counting, use a server RPC
  (`increment`-style) rather than reading and writing back a counter.
- Detect "already checked in" server-side (`unique (court_id, user_id) where active`), then treat
  a 409 as success on the client.

**Why not `BackgroundSyncPlugin`:** it stores the failed `Request` verbatim, including
`Authorization: Bearer <jwt>` and the `apikey` header, then replays it later. Supabase JWTs expire
(~1 h) → replay gets 401 permanently, and there's no hook to re-sign. It also only triggers on
`fetchDidFail` (network exception), not on 4xx/5xx. Use it only for unauthenticated, same-origin,
long-lived POSTs. For this app: implement the outbox yourself, or use a local-first engine
(Legend-State `syncedSupabase`, RxDB, PowerSync) that re-signs on replay.

**Realtime:** websockets bypass the SW entirely; offline → reconnect on `online` and resubscribe.
Don't rely on Realtime to deliver missed events; reconcile with a normal query on reconnect.

---

## 6. Storage limits and eviction

Quotas (MDN, `Storage_quotas_and_eviction_criteria`):

| Engine | Quota per origin | Persistent |
|---|---|---|
| Chromium | up to 60 % of disk (80 % total across origins) | same, exempt from LRU |
| Firefox | min(10 % of disk, 10 GiB) per site group | up to 50 % of disk, cap 8 TiB, no group limit |
| Safari 17+ | ~60 % of disk for browser apps, ~15 % for embedded webviews | same |
| Web Storage (`localStorage`+`sessionStorage`) | 10 MiB total, 5 MiB each | n/a |

Eviction:

- Best-effort by default; **LRU per origin**, and eviction deletes **all** of the origin's data, not
  parts. Your precache and `map-tiles` die together.
- **Safari:** with ITP on, an origin with no user interaction (click/tap) in **7 days** of browser use
  has script-created data deleted. Cookies set by the server are exempt. A once-a-week street
  basketball app **will** lose its caches on iOS.
- `navigator.storage.persist()` moves the origin out of best-effort: Firefox prompts, Chromium/Safari
  auto-decide from interaction history (installed PWA ≈ approved). Call it once, after meaningful
  engagement — not on first paint.
- `navigator.storage.estimate()` → `{ usage, quota }`. Useful for a settings screen ("cache: 12 MB"),
  not for pre-flight refusal (Chromium reports a huge quota that the device may not honour).

Practical rules:

- `maxEntries` is the real control, not TTL. Cache Storage has no per-entry size cap; a 1 MB response
  counts as one entry.
- Set `purgeOnQuotaError: true` on the **tile** cache so it's the first casualty, and leave the
  precache (app shell) alone.
- Never store Supabase payloads in the SW cache *and* IndexedDB — double storage, no benefit.
- iOS: assume caches vanish; the app must be usable cold-start. Precache = shell + route chunks only.

---

## 7. Corrected `app/sw.ts` (drop-in replacement)

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: WorkerGlobalScope;

// Do NOT read process.env here: the SW is built by @serwist/webpack-plugin in its own
// compilation, so Next's DefinePlugin for NEXT_PUBLIC_* is not guaranteed to apply.
const isSupabase = (url: URL) =>
  url.hostname.endsWith(".supabase.co") ||
  (url.hostname === "localhost" && url.port === "54321");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
  runtimeCaching: [
    // 1. Never touch Supabase (auth tokens, PII). Keep this FIRST.
    {
      matcher: ({ url }) => isSupabase(url),
      handler: new NetworkOnly(),
    },
    // 2. Never persist authenticated pages.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /^\/(profile|lobbies)/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    // 3. OSM tiles, viewport-driven only (policy-compliant).
    {
      matcher: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
      handler: new CacheFirst({
        cacheName: "map-tiles",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 1200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            maxAgeFrom: "last-fetched", // do not re-download on every view
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 4. Next.js defaults last.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
```

Plus `next.config.js` → `withSerwist({ ..., additionalPrecacheEntries: [{ url: "/~offline", revision }] })`
and `app/~offline/page.tsx` (static).

## 8. How to verify (the only way that counts)

1. `npm run build && npm start` — the SW does not exist under `npm run dev`.
2. DevTools → Application → Service Workers: confirm `sw.js` active; Application → Cache Storage:
   confirm `serwist-precache-*`, `map-tiles`, `cross-origin` (should **not** contain supabase URLs).
3. Pan the map, then check `map-tiles` count grows; reload offline (Network → Offline) and confirm
   tiles render, and that `/profile` offline either redirects or shows a clean state — never cached HTML.
4. `chrome://serviceworker-internals` → "Inspect" → run
   `await caches.keys()` and `await navigator.storage.estimate()` in the SW console.
5. iOS: install to home screen, use it, wait 7 days → expect an empty cache; verify cold start works.
6. Lighthouse "PWA" audit is not sufficient — it does not test offline navigation.

---

## Sources

- OSM Foundation, *Tile Usage Policy* — https://operations.osmfoundation.org/policies/tiles/
  (offline use prohibited; ≥7-day caching; Referer/User-Agent requirements)
- Serwist docs, *runtime caching / cross-origin considerations* —
  https://serwist.pages.dev/docs/serwist/runtime-caching
- Serwist docs, *ExpirationPlugin* —
  https://serwist.pages.dev/docs/serwist/runtime-caching/plugins/expiration-plugin
- Serwist docs, *setting cacheability criteria* —
  https://serwist.pages.dev/docs/serwist/guide/setting-cacheability-criteria
- Serwist docs, *expiring outdated responses* — https://serwist.pages.dev/docs/serwist/guide/expiring-outdated-responses
- Serwist docs, *navigation preloading* — https://serwist.pages.dev/docs/serwist/guide/navigation-preloading
- Serwist docs, *Next.js config / get started* — https://serwist.pages.dev/docs/next/getting-started
- Serwist docs, *disable* — https://serwist.pages.dev/docs/next/configuring/disable
- Serwist docs, *BackgroundSyncPlugin* —
  https://serwist.pages.dev/docs/serwist/runtime-caching/plugins/background-sync-plugin
- Serwist source, `defaultCache` and router order —
  `node_modules/@serwist/next/dist/index.worker.mjs`, `node_modules/serwist/dist/index.mjs:1819`
- MDN, *Storage quotas and eviction criteria* —
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN, *StorageManager.persist()* — https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- Supabase docs, *Anonymous sign-ins* (no built-in offline sync / conflict resolution) —
  https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-anonymous.mdx
- Supabase blog, *Local-first with Legend-State* —
  https://supabase.com/blog/local-first-expo-legend-state
- MapLibre GL JS + PMTiles offline (OPFS-backed plugin) —
  https://github.com/makinacorpus/maplibre-offline-pmtiles
- Protomaps docs — https://docs.protomaps.com/pmtiles/
- Measured headers: `curl -I https://tile.openstreetmap.org/14/8734/5952.png` (2026-10-30)
