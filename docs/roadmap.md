# Drop-In — Roadmap & Feature Coverage

Last updated: 2026-11-12. Scope: Next.js 15 PWA + Supabase + MapLibre. Source of truth for what ships, what is partial, and what is missing. Companion to `README.md` and `AGENTS.md`.

## Coverage status

Legend: ✅ Shipped · 🟡 Partial · 🔴 Missing

### Core domain

| Feature | Status | Notes / gaps |
|---|---|---|
| Auth (email + Google OAuth) | ✅ | Supabase SSR; callback at `app/api/auth/callback`. Login e registrazione hanno il toggle mostra/nascondi password (#74): `type="button"`, nome accessibile che cambia, target 44 px, valore e focus conservati. |
| Browse-first (unauth map/courts) | ✅ | RLS courts SELECT true. |
| Map (OSM raster, MapLibre) | 🟡 | Hardcoded `ROME_CENTER`; eager import of `maplibre-gl` in `components/map/court-map.tsx` bloats initial bundle. Warning `Expected value to be of type number` chiuso (#79): veniva dai filtri d'ordine dello stile Liberty (`rank`, `ref_length`), ora attenuati a runtime da `lib/map/style-guards.ts`; coordinate non finite filtrate prima dei marker; l'attribuzione arriva dallo stile (o dalla source raster OSM) e non è più duplicata via `customAttribution`. Causa e limiti in `docs/map.md`. |
| Court details | ✅ | Reports, lobbies, check-in, create lobby. Un campo non `approved` mostra "In attesa di approvazione" e nasconde le CTA operative (#76); l'errore P0001 dei trigger ("solo su campi approvati") ha un messaggio dedicato senza retry. |
| Lobbies (create/join/leave, realtime) | ✅ | Realtime channel on `lobbies`; auto-close +30min cron. Join su lobby chiusa dice "Lobby chiusa" senza "Riprova" e senza messaggi PostgREST grezzi (#77); orari e date sono sempre Europe/Rome esplicito (`lib/datetime.ts`), quindi niente hydration mismatch #418 (#78). |
| Check-in (GPS, 50m, cooldown 5min) | ✅ | Triggers enforce distance/cooldown; auto-checkout 2h. |
| Karma (start 90, +1 check-in, -3 no-show, ban <50 for 7d) | ✅ | `enforce_ban_on_low_karma`, `remove_expired_bans`. La notifica `karma_loss` alla chiusura della lobby è stata ripristinata dalla `027` (la `007` aveva perso l'`INSERT`). |
| Court reports (broken hoop, wet, lighting, occupied, other) | ✅ | Expiry + archive cron. |
| Profile (nickname, avatar, karma, ban banner) | ✅ | Edit sheet (RHF+zod), avatar upload nel bucket `avatars` (resize client 512 px, GC inclusa), history di check-in e karma nel profilo. La scrittura self-service è ristretta a nickname/avatar dal guard `028` (karma, ban e `is_moderator` non sono più modificabili dal client). |
| Push notifications | 🟡 | Centro notifiche in-app completo (bell realtime, lista, mark-read, 016) e feed karma di nuovo popolato (`027`). **Delivery implementata** (#25): Edge Function `send-push` (Deno, `web-push` + VAPID, sweep con tentativi e 5 cap), marcatori su `push_notifications` (`029`), subscribe reale con permesso solo su gesto, listener `push`/`notificationclick` nel SW, riga Impostazioni sbloccata, runbook in `docs/push.md`. Manca solo il deploy (VAPID + secrets + `functions deploy` + cron): non è verificabile in locale. |
| PWA offline (Serwist, tile cache 600 OFM / 1200 OSM) | ✅ | Install prompt + toast di update (#23) e mutation queue offline (#24): outbox in localStorage con dedupe per `(kind, id)`, TTL 2 h sui check-in (l'auto-checkout rende sbagliato un replay tardivo), backoff, classificazione duplicate/permanent/transient, banner di stato e replay a `online`. |

### UX / platform

| Feature | Status | Notes / gaps |
|---|---|---|
| Theming | 🟡 | Un solo tema, chiaro, accent arancione (dark rimosso in #50). Le superfici di sistema (404, error page, `<meta name="theme-color">`) seguono ancora `prefers-color-scheme`: da allineare al redesign. |
| Lazy-loaded map | ✅ | `next/dynamic` con `ssr:false` + `MapSkeleton`; MapLibre fuori dal bundle iniziale. |
| World-wide data | 🟡 | Invio comunitario e dedup/moderation attivi; `extract_osm.py` accetta `--bbox/--country/--city` con `--upsert-sql`. Manca un'estrazione globale eseguita e il seed resta Roma. |
| i18n (Italian only) | 🔴 | Hardcoded Italian strings across components; no locale routing. |
| Accessibility audit | 🟡 | Some ARIA on map markers; no full audit, focus traps in sheets unverified. |
| Test coverage | 🟡 | Vitest (**440** unit su 34 file), **40 blocchi** di asserzioni RLS su `db reset` (fino a §40: favorites, avatars, sport NULL, retract/edit, history, karma, delivery push), Playwright `e2e` (**58** test su 19 file: 31 anche senza DB, i flussi autenticati con `E2E_WITH_DB=1` — drawer-nickname, offline-queue ×3, hydration ×5, court-pending ×3, lobby-pending ×2, password-toggle ×2, settings-push) + `visual-static` (12) + `visual-full` (24), `deno test` per la Edge Function (fuori da `test:all`), CI su ogni PR. Il webServer e2e gira con `TZ=UTC` (come stage/prod) e il browser a Europe/Rome: un `toLocale*` senza fuso fa fallire i test di idratazione. |
| Error boundaries / loading states | 🟡 | Per-page loading; no global error boundary or retry. |
| Court photos / media | ✅ | Upload con ri-encodaggio, bucket `court-photos`, foto congelata dopo l'approvazione (014); miniatura 56×56 con placeholder in home e card lobby (#66, `CourtPhotoThumb`). Pulizia orfani: `npm run photos:gc` copre **entrambi** i bucket (`court-photos` e `avatars`), dry-run di default, finestra 24 h (#52); procedura e cadenza in `docs/photos-gc.md` — da schedularla solo quando c'è traffico reale. |
| Search & filter courts | ✅ | Ricerca **server-side**: `nearby_courts(p_query)` per raggio 25 km dal centro mappa, lista risultati sotto il box, marker = risultati (#68; `lib/courts/search.ts`; la 022 aggiunge `photo_path` al risultato). Filtro sport visibile in `/lobbies` tab Vicine (#65). Limiti noti: ricerca accent-sensitive (niente `unaccent()`), lo stato non sopravvive al back dal dettaglio (come lo stato mappa). Dal 2026-11-12 `sport IS NULL` = "sport non specificato" ed è visibile con **qualunque** filtro (023, #71), con l'etichetta esplicita in lista: restano 6.364 corti su 10.130 da backfillare (#63). |
| Favorites / saved courts | ✅ | `user_favorites` (024, RLS own-rows, solo campi `approved`), toggle ottimistico nella scheda campo, `/favorites` con empty state, riga "Campi salvati" nel profilo. |
| Install prompt (PWA) | ✅ | Banner in-flow (`components/pwa/install-prompt.tsx`), dismiss persistito 30 giorni, fallback iOS "Condividi → Aggiungi a Home", toast "Nuova versione attiva" su `controllerchange`; seam puro `lib/pwa/install.ts`. |
| Offline mutation queue | ✅ | `lib/offline/outbox.ts` (seam puro) + store + runner montato in `(app)` e `(dashboard)`; check-in, join e leave accodati offline e reinviati a `online`; e2e offline→online senza duplicati. |
| Analytics / observability | 🔴 | `lib/logger.ts` only; no error tracking. |
| Moderation / admin | 🟡 | Coda e RPC (`approve/reject/mark_duplicate`) documentate in `docs/moderation.md`, eseguibili da Studio. Nessuna UI. |
| Court verification / dedup | ✅ | `dedup_candidates` a 100 m con conferma esplicita, mascheramento delle proposte altrui, coda di moderazione. |

## Gaps not yet ticketed (review 2026-11-12)

| Area | Gap | Priorità |
|---|---|---|
| Dati | Audit manuale dei ~10.130 punti OSM (#63): campi inesistenti, duplicati, coordinate sbagliate | Alta |
| Legale/privacy | Privacy policy, ToS, cookie/consent, export dati, cancellazione account (GDPR) | Alta prima di utenti reali |
| Sicurezza/abuso | Rate limit globale, moderazione foto, spam submission, WAF/edge rules | Alta |
| Osservabilità | Sentry/error tracking, uptime monitor, metriche (DAU, retention, funnel), log retention | Media |
| CI/CD | Deploy staging→prod automatizzato, backup/DR, migrazioni promotion, rollback | Alta |
| Mappa | Clustering marker (#42), tile provider/offline PMTiles, a11y mappa (#44), errori tile (#39) | Media |
| Multi-sport | Sport enum/validazione, UI dedicata, dati oltre basket; timezone/locale | Media |
| Email | SMTP dedicato / deliverability (Supabase built-in 2/h), template auth | Media |
| Community | Linee guida, segnalazione abusi, ownership/claim campo, moderazione UI (#33) | Media |
| PWA | Deploy della push delivery (#15): VAPID, secrets, `functions deploy`, cron — codice completo, `docs/push.md` | Media |
| Performance | Budget JS/LCP/CLS/TBT, visual regression in CI (già baseline), monitoraggio | Bassa |
| i18n | IT/EN, routing locale, notifiche localizzate (#64) | Bassa |

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
- **Phase 1 (data growth):** ✅ chiusa 2026-11-12 — #6 community submission, #7 global extraction (script), #8 dedup/moderation, #9 radius query, #10 search/filter (#68), foto (#66), filtro sport (#65), staging allineato a `022` (#53), GC orfani (#52 esteso al bucket avatar). #58 (retract/edit pending) e #71 (semantica `sport IS NULL`) chiusi il 2026-11-12 con migrazioni `026` e `023`. Resta #63 (audit dati OSM).
- **Phase 2 (engagement):** ✅ codice completo — #12 favorites (`024`), #17 avatar (`025`), #16 history (+`027`), #13 install/update PWA, #14 offline queue, #15 push delivery (`029`). Resta il deploy della push (VAPID + secrets + cron, `docs/push.md`) e la verifica su staging.
- **Phase 3 (polish/platform):** piano in `docs/plans/phase3.md` — 3A mappa (#40–#44), 3B moderazione/community (#33, #47, #45, #63), 3C platform/ops (#32/#9, #37, #64, legal/privacy, security, CI/CD).

## Verification (definition of done for each ticket)

- Build: `npm run build` passes; `npm run lint` clean.
- Typecheck: `npm run typecheck` (tsc --noEmit) passes.
- Manual: feature works on mobile viewport (360px) and desktop; offline behavior documented where relevant.
- DB changes: new migration file under `supabase/migrations/` with RLS policies; `npx supabase db reset` succeeds.
- No regression: existing map/courts/lobbies/check-in flows still functional.
