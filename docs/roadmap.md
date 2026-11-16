# Drop-In — Roadmap & Feature Coverage

Last updated: 2026-11-16 (Phase 4B). Scope: Next.js 15 PWA + Supabase + MapLibre. Source of truth for what ships, what is partial, and what is missing. Companion to `README.md` and `AGENTS.md`.

Tracker: le issue GitHub sono state ripulite il 2026-11-16 (30 chiuse con evidenza, 6 ticket nuovi sui gap che non ne avevano). Vedi `## Tracker (2026-11-16)` in fondo per l'elenco e il perché.

## Coverage status

Legend: ✅ Shipped · 🟡 Partial · 🔴 Missing

### Core domain

| Feature | Status | Notes / gaps |
|---|---|---|
| Auth (email + Google OAuth) | ✅ | Supabase SSR; callback at `app/api/auth/callback`. Login e registrazione hanno il toggle mostra/nascondi password (#74): `type="button"`, nome accessibile che cambia, target 44 px, valore e focus conservati. |
| Browse-first (unauth map/courts) | ✅ | RLS courts SELECT true. |
| Map (OSM raster, MapLibre) | ✅ | Marker **vettoriali su source GeoJSON** con clustering (`clusterRadius 50`, `maxzoom 14`): a zoom 14 con 200+ campi niente blob, i cluster mostrano il conteggio e si espandono al tap (#42). Stati distinguibili senza click — default, preferito, lobby attiva (con numero), segnalato, selezionato — con priorità `segnalato > lobby > preferito > default` (#41). Tap su un punto apre un'**anteprima** (foto, nome, indirizzo, sport/fondo, lobby attive) senza ricaricare l'app, chiusa da Esc/backdrop con focus che torna alla mappa; "Apri dettaglio" è una navigazione client (#43). A11y: la superficie mappa è **un solo tab stop** (frecce = pan, `+`/`-` = zoom, `Home` = ricentra), canvas decorativo, "Lista campi" apre le 30 voci ordinate e una live region annuncia selezione e conteggio (#44). Errori tile post-load aggregati (5 in 10 s) con banner non bloccante e Riprova (#39). Restano: `ROME_CENTER` come centro iniziale e nessuna basemap offline. Dettagli in `docs/map.md`, `docs/design/patterns/map.md`. |
| Court details | ✅ | Reports, lobbies, check-in, create lobby. Un campo non `approved` mostra "In attesa di approvazione" e nasconde le CTA operative (#76); l'errore P0001 dei trigger ("solo su campi approvati") ha un messaggio dedicato senza retry. |
| Lobbies (create/join/leave, realtime) | ✅ | Realtime channel on `lobbies`; auto-close +30min cron. Join su lobby chiusa dice "Lobby chiusa" senza "Riprova" e senza messaggi PostgREST grezzi (#77); orari e date sono sempre Europe/Rome esplicito (`lib/datetime.ts`), quindi niente hydration mismatch #418 (#78). |
| Check-in (GPS, 50m, cooldown 5min) | ✅ | Triggers enforce distance/cooldown; auto-checkout 2h. |
| Karma (start 90, +1 check-in, -3 no-show, ban <50 for 7d) | ✅ | `enforce_ban_on_low_karma`, `remove_expired_bans`. La notifica `karma_loss` alla chiusura della lobby è stata ripristinata dalla `027` (la `007` aveva perso l'`INSERT`). |
| Court reports (broken hoop, wet, lighting, occupied, other) | ✅ | Expiry + archive cron. |
| Profile (nickname, avatar, karma, ban banner) | ✅ | Edit sheet (RHF+zod), avatar upload nel bucket `avatars` (resize client 512 px, GC inclusa), history di check-in e karma nel profilo. La scrittura self-service è ristretta a nickname/avatar dal guard `028` (karma, ban e `is_moderator` non sono più modificabili dal client). |
| Push notifications | 🟡 | Centro notifiche in-app completo (bell realtime, lista, mark-read, 016) e feed karma di nuovo popolato (`027`). **Delivery implementata** (#25): Edge Function `send-push` (Deno, `web-push` + VAPID, sweep con tentativi e 5 cap), marcatori su `push_notifications` (`029`), subscribe reale con permesso solo su gesto, listener `push`/`notificationclick` nel SW, riga Impostazioni sbloccata, runbook in `docs/push.md`. **Manca il deploy** (VAPID + secrets + `functions deploy` + cron): non è verificabile in locale, ticket #87. |
| PWA offline (Serwist, tile cache 600 OFM / 1200 OSM) | ✅ | Install prompt + toast di update (#23) e mutation queue offline (#24): outbox in localStorage con dedupe per `(kind, id)`, TTL 2 h sui check-in (l'auto-checkout rende sbagliato un replay tardivo), backoff, classificazione duplicate/permanent/transient, banner di stato e replay a `online`. |

### UX / platform

| Feature | Status | Notes / gaps |
|---|---|---|
| Theming | ✅ | Un solo tema, dark: niente toggle, niente `data-theme`, niente varianti `dark:` (`docs/design/themes.md`). Le superfici di sistema (404, error page, `<meta name="theme-color">`) sono allineate al tema. |
| Lazy-loaded map | ✅ | `next/dynamic` con `ssr:false` + `MapSkeleton`; MapLibre fuori dal bundle iniziale. |
| World-wide data | 🟡 | Invio comunitario e dedup/moderation attivi; `extract_osm.py` accetta `--bbox/--country/--city` con `--upsert-sql`. Manca un'estrazione globale eseguita e il seed resta Roma. |
| i18n (Italian only) | 🟡 | Fondazione pronta (#64): `lib/i18n/*` con dizionario IT/EN tipizzato (nav, auth, azioni, errori, a11y), `Accept-Language` con q-values, `localePath` (IT non prefissato, EN sotto `/en`), 10 test. UI non migrata e routing non attivo di proposito: piano a fasi in `docs/i18n.md`. |
| Accessibility audit | ✅ | Mappa coperta (#44: un tab stop, lista campi, live region, 44px) e axe verde su `/`, `/admin`, `/submit-court` (wcag2a/2aa/21aa/22aa). Phase 4B (#29): focus trap **deterministico** in `lib/a11y/focus-trap.ts` (24 Tab + 12 Shift+Tab restano nel drawer, Escape → trigger), axe con l'anteprima campo aperta, misure 44px a 360px documentate in `docs/design/accessibility.md`. |
| Test coverage | 🟡 | Vitest (**599** unit su 42 file, +129 tra mappa/clustering, logger, share, posizione manuale, coda moderazione, mio invio — tutti verdi al 2026-11-16), **43 blocchi** di asserzioni RLS su `db reset` (fino a §43: favorites, avatars, sport NULL, retract/edit, history, karma, delivery push, resubmit/storia audit, indirizzo), Playwright `e2e` (**58** test su 19 file: i flussi autenticati con `E2E_WITH_DB=1` — drawer-nickname, offline-queue ×3, hydration ×5, court-pending ×3, lobby-pending ×2, password-toggle ×2, settings-push, a11y mappa da tastiera) + `visual-static` (12) + `visual-full` (24), `deno test` per la Edge Function (fuori da `test:all`), CI su ogni PR. Il webServer e2e gira con `TZ=UTC` (come stage/prod) e il browser a Europe/Rome: un `toLocale*` senza fuso fa fallire i test di idratazione. |
| Error boundaries / loading states | ✅ | `app/error.tsx` (per rotta, log + Riprova) e `app/global-error.tsx` (fallback con colori/font di sistema, Riprova e uscita verso la mappa), loading per pagina, toast `sonner` sulle azioni fallite (#31). Non c'è retry automatico delle richieste di rete fallite: si riprova dall'azione. |
| Court photos / media | ✅ | Upload con ri-encodaggio, bucket `court-photos`, foto congelata dopo l'approvazione (014); miniatura 56×56 con placeholder in home e card lobby (#66, `CourtPhotoThumb`). Pulizia orfani: `npm run photos:gc` copre **entrambi** i bucket (`court-photos` e `avatars`), dry-run di default, finestra 24 h (#52); procedura e cadenza in `docs/photos-gc.md` — da schedularla solo quando c'è traffico reale. |
| Search & filter courts | ✅ | Ricerca **server-side**: `nearby_courts(p_query)` per raggio 25 km dal centro mappa, lista risultati sotto il box, marker = risultati (#68; `lib/courts/search.ts`; la 022 aggiunge `photo_path` al risultato). Filtro sport visibile in `/lobbies` tab Vicine (#65). Limiti noti: ricerca accent-sensitive (niente `unaccent()`), lo stato non sopravvive al back dal dettaglio (come lo stato mappa). Dal 2026-11-12 `sport IS NULL` = "sport non specificato" ed è visibile con **qualunque** filtro (023, #71), con l'etichetta esplicita in lista: restano 6.364 corti su 10.130 da backfillare (#63). |
| Favorites / saved courts | ✅ | `user_favorites` (024, RLS own-rows, solo campi `approved`), toggle ottimistico nella scheda campo, `/favorites` con empty state, riga "Campi salvati" nel profilo. |
| Install prompt (PWA) | ✅ | Banner in-flow (`components/pwa/install-prompt.tsx`), dismiss persistito 30 giorni, fallback iOS "Condividi → Aggiungi a Home", toast "Nuova versione attiva" su `controllerchange`; seam puro `lib/pwa/install.ts`. |
| Offline mutation queue | ✅ | `lib/offline/outbox.ts` (seam puro) + store + runner montato in `(app)` e `(dashboard)`; check-in, join e leave accodati offline e reinviati a `online`; e2e offline→online senza duplicati. |
| Analytics / observability | ✅ | `lib/logger.ts` (#37) + `/api/health` (200/503, latenza DB, commit, uptime) e log JSON per evento (`lib/observability/structured.ts`, redazione chiavi) con `server.boot` da `instrumentation.ts` (#88). Decisioni tracciate in `docs/observability.md`: niente Sentry (#32) e niente analytics terzo (#9) ora, con criteri di riapertura. Retention reale: ~1 giorno sui piani free. |
| Moderation / admin | ✅ | `/admin` (#33): coda proposte con dettaglio, candidati duplicati (righe altrui mascherate), Approva / Rifiuta con nota / Duplicato di, refetch dopo l'azione senza optimistic update; segnalazioni attive raggruppate per campo in sola lettura (scadono da sole). Gate server-side in due passi (sessione → `profiles.is_moderator`) e RPC che si autoproteggono; voce "Moderazione" in Impostazioni solo per moderatori. L'esito torna al proponente: notifica in `approve_court`/`reject_court` e percorso di correzione `resubmit_submission` (con nuova riga di audit, storia conservata), UI "Rifiutata" + `Motivo:` + "Riprova" (#47, migration `030`). Modello e limiti in `docs/moderation.md`. |
| Court verification / dedup | ✅ | `dedup_candidates` a 100 m con conferma esplicita, mascheramento delle proposte altrui, coda di moderazione. |

## Gaps aperti, con ticket (2026-11-16)

Tutti i gap sotto hanno una issue: niente più voci senza tracker.

| Area | Gap | Priorità | Ticket |
|---|---|---|---|
| Dati | Audit manuale dei ~10.130 punti OSM: campi inesistenti, duplicati, coordinate sbagliate | Alta | #63 |
| Legale/privacy | Privacy policy, ToS, cookie/consent, export dati, cancellazione account (GDPR) | Alta prima di utenti reali | #83 |
| Sicurezza/abuso | Rate limit globale, moderazione foto, spam submission, WAF/edge rules | Alta | #84 |
| CI/CD | Deploy staging→prod, backup/DR, promotion migrazioni, rollback | Alta | #85 |
| Email | SMTP dedicato / deliverability (Supabase built-in 2/h), template auth | Media | #86 |
| PWA | Deploy della push delivery: VAPID, secrets, `functions deploy`, cron — codice completo, `docs/push.md` | Media | #87 |
| Osservabilità | Sentry/error tracking | Media | #32 |
| Osservabilità | Uptime monitor, metriche (DAU, retention, funnel), log retention | Media | #88 |
| Analytics | Decisione sullo stack di tracking (privacy-first, session replay, perf) | Media | #9 |
| A11y | Focus trap di sheet/bottom-sheet e contrasto runtime dei componenti nuovi | Media | #29 |
| Community | Court ratings and reviews | Media | #34 |
| Onboarding | Onboarding multi-step per la scelta dello sport (bozza, decisione di prodotto mancante) | Media | #45 |
| i18n | IT/EN, routing locale, notifiche localizzate | Bassa | #64 |
| Mappa | Tile provider/offline PMTiles (basemap offline), centro iniziale non hardcoded | Bassa | — (dettagli in `docs/map.md`) |
| Multi-sport | Sport enum/validazione, UI dedicata; timezone/locale | Bassa | — (coperto in parte da #64) |
| Community | Linee guida, segnalazione abusi, ownership/claim campo | Media | — |
| Performance | Budget JS/LCP/CLS/TBT, monitoraggio | Bassa | — (baseline visual in CI già presente) |
| Test | Retest manuale su iPhone reale (Safari vs PWA) | Media | #80 |

Le righe senza ticket (Mappa offline, Multi-sport, Community, Performance) sono backlog minore, senza lavoro avviabile finché non c'è una decisione: se servono, si aprono quando si parte, non restano come "gap non tracciati".


## Proposte originali (2026-11-05) — chiuse

Le 25 proposte che stavano qui sono state create come issue **#11–#35** e ripulite il 2026-11-16: chiuse quelle con evidenza (file, migrazioni, test), chiuse come superate #11/#12/#13 (tema unico, niente toggle) e #28 (duplicato di #64). Restano aperte #29, #32 e #34.

Questa sezione non raccoglie più proposte: i gap nuovi si aprono direttamente su GitHub e qui si tiene solo la mappa gap → ticket.

## Suggested sequencing (phases)

- **Phase 0 (foundations):** ✅ chiusa — mappa lazy (#14), test framework + CI (#30), error boundary e retry (#31). Le voci tema (#11/#12/#13) sono state superate dal tema unico dark.
- **Phase 1 (data growth):** ✅ chiusa 2026-11-12 — submission (#16), estrazione OSM (#17), dedup/moderation (#18), radius query (#19), ricerca/filtro (#20, #68), foto (#21, #66), filtro sport (#65), staging allineato a `022` (#53), GC orfani (#52 esteso al bucket avatar). #58 (retract/edit pending) e #71 (semantica `sport IS NULL`) chiusi con migrazioni `026` e `023`. Resta #63 (audit dati OSM).
- **Phase 2 (engagement):** ✅ codice completo — favorites (#22, `024`), avatar (#27, `025`), history (#26, `027`), install/update PWA (#23), offline queue (#24), push delivery (#25, `029`). Resta il deploy della push (#87) e la verifica su staging.
- **Phase 3 (polish/platform):** piano in `docs/plans/phase3.md` — 3A mappa ✅ (#40–#44, #39), 3B ✅ moderazione (#33, #47) e submit senza GPS (#75), ✅ share/OG (#35) e log (#37). Aperto 3C: #32 (Sentry), #88 (uptime/metriche), #9 (analytics), #83 (legal), #84 (sicurezza), #85 (CI/CD), #86 (email); più #63, #45, #34, #64, #29, #80.


## Verification (definition of done for each ticket)

- Build: `npm run build` passes; `npm run lint` clean.
- Typecheck: `npm run typecheck` (tsc --noEmit) passes.
- Manual: feature works on mobile viewport (360px) and desktop; offline behavior documented where relevant.
- DB changes: new migration file under `supabase/migrations/` with RLS policies; `npx supabase db reset` succeeds.
- No regression: existing map/courts/lobbies/check-in flows still functional.

## Phase 4B — platform hardening (2026-11-16)

Otto lane eseguite in sequenza su branch dedicati (`phase4b/*`) e unite su
`master` con merge `--no-ff` nell'ordine concordato. Ogni lane ha un commit
proprio; il dettaglio tecnico sta nel documento della lane, non qui.

| Lane | Ticket | Cosa è entrato | Verifica |
|---|---|---|---|
| security | #84 | `034` rate limit per (bucket, utente) su report/lobby/join/review/check-in + guard anti-link; `035` grant al minimo; header di sicurezza nel middleware (`lib/security/headers.ts`) | RLS blocchi 45-46, 4 unit header; suite e2e completa verde |
| email | #86 | 5 template auth brandizzati + `[auth.email.template.*]`, runbook SMTP `docs/email.md` (Resend/Brevo vs built-in 2/h) | 8 unit template; recupero password reale su Mailpit |
| ci | #85 | job `rls` ed `e2e` (Supabase locale) in `ci.yml`, `backup.yml`, `stage-smoke.yml`, `scripts/backup-db.sh` + `restore-db.sh`, `scripts/smoke.mjs`, `docs/ci.md` | backup 1,1 MB; restore drill 10.130 courts/35 migrazioni; smoke 200 |
| a11y | #29 | focus trap deterministico nel Drawer (`lib/a11y/focus-trap.ts`), test 44px, axe con anteprima aperta | 19 e2e a11y (7 senza DB), 7 unit trap |
| observability | #32/#9/#88 | `GET /api/health` (ok/degraded, 503), `lib/observability/*` (health + log JSON con redazione), `instrumentation.ts` server.boot, `docs/observability.md` con decisioni (niente Sentry/analytics ora) | 11 unit, curl reale 200, build |
| legal | #83 | pagine `/legal/{privacy,terms,cookies}` + link in Impostazioni, inventario dati e checklist `docs/legal/README.md` | 6 e2e legal (axe 0, senza DB), build |
| data audit | #63 | `scripts/audit_courts.py` (batch, priorità, doppioni <50 m, link), `docs/audit/` con batch 01, `docs/audit-courts.md` | 19 test python offline, statistiche reali 6.329/3.405/340/56 |
| i18n | #64 | `lib/i18n/*` (dizionario IT/EN tipizzato, `Accept-Language`, `localePath`), `docs/i18n.md` con piano a fasi | 10 unit; routing non attivato di proposito |

Stato dei ticket dopo il merge: **#84, #85, #86, #83, #63, #29, #88, #32, #9,
#64 hanno ora codice/evidenza in master ma restano aperti** finché non si
chiudono sul tracker con il commento di evidenza (operazione del coordinatore)
e, per #63, finché i 203 batch di audit non sono passati da una persona.

Resta fuori da questa fase (richiede l'utente o un ambiente esterno):

- **deploy stage fatto**: `drop-in-stage.vercel.app` serve `a9e29bc` (smoke
  con commit atteso verde, `/api/health` ok sul DB di staging). Restano da
  provare con credenziali reali email e backup; `prod` non è toccata
  (`production` ferma a `022`). CI su `master` verde (quality + rls + e2e)
  dal commit `c7323f2`;
- `REVOKE` su `public.spatial_ref_sys` (owner `supabase_admin`, SQL in
  `docs/security.md`) su staging/prod;
- VAPID + `functions deploy` per la push (#87, già codice completo);
- validazione legale dei testi e rimozione dei placeholder.

Gate usati: `npm run test:all` verde su master (666 unit, 46 blocchi RLS, e2e
senza DB), `E2E_WITH_DB=1 npx playwright test --project=e2e` (71 test; un flake di
animazione rientrato al secondo giro), `npm run build` e
`python3 -m unittest discover -s tests/python`.

## Tracker (2026-11-16)

Regola: un ticket si chiude solo con evidenza (file, migrazione, test, deploy). Punto di partenza: 38 issue aperte.

**Chiuse con evidenza (30)** — ognuna ha un commento con il riferimento:

| Gruppo | Issue |
|---|---|
| Mappa | #39 (errori tile), #40 (epica), #41 (marker), #42 (clustering), #43 (anteprima), #44 (a11y) |
| Dati | #16 (submission), #17 (estrazione OSM), #18 (dedup/moderation), #20 (ricerca) |
| Engagement | #21 (foto), #22 (favorites), #23 (install prompt), #24 (offline queue), #25 (push, codice), #26 (history), #27 (avatar) |
| Piattaforma | #30 (test + CI), #31 (error boundary), #33 (admin), #35 (share/OG), #37 (logging), #47 (esito/resubmit), #75 (submit senza GPS) |
| Performance | #14 (mappa lazy), #15 (bundle) |
| Superate | #11, #12 (toggle e persistenza tema: tema unico dark), #13 (varianti dark: sono l'unico tema), #28 (duplicato di #64) |

**Aperte (14)** — con il motivo:

| Issue | Perché resta aperta |
|---|---|
| #9 | **Decisione presa in Phase 4B**: niente analytics terzo ora, log first-party + criteri di riapertura (`docs/observability.md`). Issue da chiudere con evidenza. |
| #29 | **Implementato in Phase 4B**: trap deterministico, axe con sheet aperto, target 44px (`docs/design/accessibility.md`). Issue da chiudere con evidenza. |
| #32 | **Decisione presa**: niente Sentry ora (bundle/costo/PII), con trigger di riapertura; log strutturati e boundary coprono (`docs/observability.md`). Issue da chiudere con evidenza. |
| #34 | Ratings/reviews: nessuna tabella in `supabase/migrations/` |
| #45 | Onboarding sport: dipendenze pronte (`lib/sport/`), flusso multi-step mai scritto; serve decisione di prodotto |
| #63 | **Strumenti pronti, lavoro umano aperto**: script + primo batch (`docs/audit-courts.md`), restano 203 batch. |
| #64 | **Fondazione pronta** (dizionario IT/EN, detection, test); routing e migrazione UI pianificati (`docs/i18n.md`). |
| #80 | Retest su iPhone reale (Safari vs PWA): codice già in master |
| #83 | **Pagine pubblicate** con bozza tecnica; restano i `[DA COMPILARE]` e la validazione legale (`docs/legal/README.md`). |
| #84 | **Implementato** eccetto la query una-tantum su `spatial_ref_sys` e le regole WAF (piano Pro, non adottate) — `docs/security.md`. |
| #85 | **Job CI, backup/restore e runbook pronti**; restano i secret (`STAGE_DB_URL`), il primo run e il backup prod (`docs/ci.md`). |
| #86 | **Template e runbook pronti**; restano dominio/DNS e credenziali SMTP (`docs/email.md`). |
| #87 | Nuovo — deploy della push (VAPID, secrets, cron) |
| #88 | **Health endpoint e log strutturati**; uptime monitor da configurare e metriche prodotto ancora da decidere (`docs/observability.md`). |

Nessun ticket aperto senza un gap corrispondente in `## Gaps aperti, con ticket`; nessuno chiuso senza un commento con l'evidenza.
