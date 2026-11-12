# Phase 2 — Piano engagement

Bozza di @oracle, rivista e aggiornata il 2026-11-12 a fine Phase 1. Da rileggere con il codice davanti, non fidarsi ciecamente.

**Punto di partenza (verificato).** Phase 1 è mergiata in `master` (PR #70) e deployata: staging e produzione sono entrambi a `022` con 10.130 corti. Migrazioni usate: `023`→`029` (la `029` è la push delivery); prossima libera: `030`.

## Stato al 2026-11-12 (fine sessione)

Fatto e verificato (`npm run test:all` verde: lint, lint:design, tsc, vitest, test:rls 36 blocchi, e2e):

| Item | Migrazione | Note |
|---|---|---|
| Precondizione #71/#72 — `sport IS NULL` | `023_sport_null_visible.sql` | NULL = "sport non specificato", visibile con qualunque filtro nelle tre RPC di lettura; `sportMatches` allineato; etichetta "Sport non specificato" in lista risultati e card lobby; semantica in `docs/rpc.md`; unit + blocco RLS 35. |
| Precondizione #58 — retract/edit pending | `026_pending_submission_edit.sql` | `retract_submission` + `update_pending_submission` (guardie di proprietà/stato in SQL, 42501 vs P0001), sezione "Le tue proposte" su `/submit-court`; unit + blocco RLS 36. |
| Precondizione #52 — GC orfani | — | `scripts/cleanup-orphan-photos.mjs` copre `court-photos` **e** `avatars`; procedura e cadenza in `docs/photos-gc.md` (niente pg_cron: non può chiamare la Storage API). |
| 6. Favorites (#22) | `024_favorites.sql` | Tabella + RLS own-rows approved-only, toggle ottimistico, `/favorites`, riga "Campi salvati"; unit + blocco RLS 33. |
| 5. Avatar (#27) | `025_avatars_bucket.sql` | Bucket `avatars` (prefisso uid), resize+crop client 512 px, avatar in header, rimozione nel drawer; unit + blocco RLS 34. |
| 4. Profile history (#26) | `027_karma_loss_notification.sql` | `lib/profile/history.ts` + lista con "mostra altri" e empty state; unit + blocchi RLS 37/38. La `027` ripristina l'`INSERT` in `push_notifications` che la `007` aveva perso: senza, la metà karma della storia era vuota per costruzione. |
| Hardening dal review (028) | `028_profile_self_service_guard.sql` | La policy UPDATE su `profiles` era `auth.uid() = user_id` senza restrizioni di colonna: un utente poteva darsi karma, togliersi il ban e puntare `avatar_url` sull'oggetto di un altro. Trigger `guard_profile_self_service()`: self-service limitato a nickname/avatar (prefisso proprio), scritture interne dei trigger karma/ban lasciate passare via `pg_trigger_depth() > 1`; blocco RLS 39. |
| 2. Offline queue (#24) | — | `lib/offline/outbox.ts` (dedupe per `(kind, id)`, TTL 2 h sui check-in, backoff 5 s→5 min, duplicate/permanent/transient), `outbox-store` + runner in `(app)`/`(dashboard)`, banner di stato; check-in, join e leave accodati e reinviati a `online`. 33 unit + e2e offline→online (join e leave) senza duplicati. |
| 3. Push delivery (#25) | `029_push_delivery.sql` | Edge Function `send-push` (Deno, `web-push`+VAPID, sweep 50 righe, 404/410 rimuove la subscription, 5 tentativi), marcatori `push_sent_at`/`push_attempts`/`push_failed_at`, subscribe reale con permesso solo su gesto, listener `push`/`notificationclick` nel SW, riga Impostazioni sbloccata, runbook `docs/push.md`. `deno test` 8 casi + 15 unit. Deploy (VAPID, secrets, cron) resta da fare. |
| 1. Install/update PWA (#23) | — | `lib/pwa/install.ts` puro, banner con dismiss 30 giorni, fallback iOS, toast su `controllerchange`, manifest con icona maskable e screenshot; unit. |

Codice di tutti e sei gli item completo. Restano fuori dal codice: il **deploy della push delivery** (VAPID + secrets + `functions deploy` + cron, vedi `docs/push.md`) e la **verifica live su staging** di tutto il blocco (deploy del branch su Vercel Preview + `supabase db push` di `023`→`029` su staging).

Numerazione migrazioni aggiornata: `023` sport NULL, `024` favorites, `025` avatars, `026` pending edit, `027` karma-loss restore, `028` guard self-service profili, `029` push delivery; prossima libera `030`.

**Residui Phase 1**: #58, #71 e #52 sono chiusi in questa sessione (vedi la tabella sopra). Resta #63 (audit dati OSM, progetto separato): sulle 10.130 corti attuali 6.364 hanno `sport` NULL e ora sono visibili con qualunque filtro grazie alla semantica della `023`.

**Verifica live**: stage = https://drop-in-stage.vercel.app (alias custom da riassegnare a ogni release), prod = https://drop-in-rho.vercel.app.

## 1. PWA install prompt + update toast (#23 / update-prompt)

- **Obiettivo:** catturare `beforeinstallprompt`, CTA "Installa" una volta sola (dismiss persistito); toast "Nuova versione attiva" al cambio SW.
- **File:** nuovi `components/pwa/install-prompt.tsx` + `components/pwa/sw-update-toast.tsx`, montati in `app/layout.tsx` accanto al Toaster; icona maskable + `screenshots` in `public/manifest.json`.
- **Migrazioni:** nessuna.
- **Seam TDD:** `lib/pwa/install.ts` puro — `shouldShowInstallPrompt(deferred, dismissedAt, now)`, parsing `appinstalled`; vitest senza DOM.
- **UI/@designer:** sì (banner + toast, copy IT, 360px, tema dark-only).
- **Rischi:** iOS non ha `beforeinstallprompt` → fallback "Condividi → Aggiungi a Home"; `skipWaiting:true + clientsClaim:true` (`app/sw.ts`) = update forzato, il toast è informativo e non bloccante.
- **Effort:** 1 g. **Exit:** `npm run test:unit` verde + su stage (Android/Chrome): banner visibile, dismiss persistito al reload, toast dopo deploy N+1.
- **Staging-first:** installabile solo su HTTPS con SW attivo → `drop-in-stage.vercel.app`, mai in locale.

## 2. Offline mutation queue (#24)

- **Obiettivo:** check-in e join/leave lobby accodati offline (outbox) e ritentati a `online`, con stato visibile.
- **File:** nuovo `lib/offline/outbox.ts` (puro) + banner di stato; punti di innesto: `components/check-in/check-in-sheet.tsx` (insert), `components/lobby/lobby-detail.tsx` (join insert / leave delete). Riusare il pattern `navigator.onLine` già presente in `components/notifications/notification-list.tsx` e il banner di connessione in `app/(app)/page.tsx`.
- **Migrazioni:** nessuna (solo client). Idempotenza garantita dal DB: `UNIQUE(lobby_id,user_id)` + trigger cooldown 5 min + distanza 50 m.
- **Seam TDD:** `outbox.ts` — enqueue/dequeue/dedupe per chiave `(type, court_id|lobby_id)`, backoff, classificazione errori; vitest puro.
- **UI/@designer:** sì (stati in coda / inviato / fallito).
- **Rischi:** replay con coordinate originali → il trigger distanza valida lat/lng salvati, non il GPS live, quindi un replay ore dopo può passare fuori luogo; **scartare i check-in in coda da più di 2 h** (auto-checkout pg_cron). Errore di cooldown al replay = "già registrato", non errore. Il SW forza `NetworkOnly` su Supabase: la coda vive solo nel client.
- **Effort:** 4–5 g. **Exit:** unit sull'outbox + Playwright offline→online su stage: join accodato, inviato al reconnect, nessun duplicato, toast corretto.

## 3. Push delivery Edge Function (#25) — gap reale

- **Stato vero (verificato):** centro notifiche in-app **già completo** — bell realtime, lista paginata con mark-read, `karma-listener`, pagina `/notifications`, `016_notification_read.sql`, trigger `002` (lobby-soon cron 5 min, participant-joined, karma-loss). **`docs/roadmap.md:22` è stantia** ("no in-app notification center" è falso). Stub solo `push-provider.tsx` (mai subscribe, niente VAPID); `supabase/functions/` non esiste.
- **Gap = solo delivery:** Edge Function `supabase/functions/send-push/` (Deno, `web-push`, VAPID), trigger HTTP su insert `push_notifications` (pg_net) o cron sweep `sent_at IS NULL`; subscribe/unsubscribe reale in `push-provider.tsx` → `push_subscriptions`; sbloccare la riga "Notifiche push" in `components/settings/notifications-section.tsx`.
- **Migrazioni:** `029_push_delivery.sql` — fatta: `push_sent_at`/`push_attempts`/`push_failed_at` + indice parziale dello sweep; `sent_at` NON è un marcatore di delivery (ha DEFAULT `now()` all'INSERT).
- **Seam TDD:** payload builder `notification → {title, body, url}` riusando `notificationHref` (già coperto da `tests/unit/notifications-link.test.ts`); test Deno fuori `test:all`.
- **UI/@designer:** minimo (sblocco riga settings + permesso browser).
- **Rischi:** VAPID keys in Dashboard staging/prod (secret, mai repo); iOS push solo se PWA installata (16.4+); `sent_at` mai valorizzato oggi → criterio di invio da definire; free plan con invocazioni Edge limitate.
- **Effort:** 4 g. **Exit:** deploy funzione su staging + subscribe reale (Chrome Android) → join da secondo utente → push entro ~1 min; `test:rls` invariato.

## 4. Profile history (#26)

- **Obiettivo:** lista check-in passati (campo, data, stato) + eventi karma nel profilo.
- **File:** `app/(app)/profile/page.tsx` (query: ultimi N `check_ins` join `courts`) + nuovo `components/profile/history-list.tsx`.
- **Migrazioni:** nessuna per v1 (sola lettura). Un eventuale ledger karma (una migrazione successiva alla `029`, la `030`) solo se la derivazione dagli eventi risulta ambigua — default: no.
- **Seam TDD:** `lib/profile/history.ts` (mapping righe → voci UI, label "−3 no-show"); vitest su fixture.
- **UI/@designer:** sì (lista, empty state, "mostra altri").
- **Rischi:** policy SELECT su `check_ins` ("viewable by everyone") da ricontrollare in `test:rls`; nessun indice dedicato al volume.
- **Effort:** 2 g. **Exit:** `test:unit` + `test:rls` + su stage il profilo mostra almeno una voce reale dopo un check-in.

## 5. Avatar upload (#27)

- **Obiettivo:** upload avatar in `EditProfileSheet`, mostrato in `ProfileHeader` (oggi solo iniziali; `avatar_url` esiste da `001` ma non viene mai letto).
- **File:** nuovo `lib/storage/avatars.ts` (riusa il resize client da `lib/storage/court-photos.ts`), `edit-profile-sheet.tsx`, `profile-header.tsx` (render `avatar_url ?? iniziali`).
- **Migrazioni:** `025_avatars_bucket.sql` (bucket `avatars`, lettura pubblica, 5 MB, prefisso `{auth.uid()}/`, policy speculari a `court-photos`) + `npm run types` (mai hand-edit `database.types.ts`).
- **Seam TDD:** riuso `computeTargetSize`; nuovo validatore path `startsWith(uid)`.
- **UI/@designer:** sì (crop quadrato, preview, stati upload).
- **Rischi:** free plan 1 GB e **niente image transforms** → resize client obbligatorio; re-upload crea orfani → includere il bucket `avatars` nello script GC di #52.
- **Effort:** 2–3 g. **Exit:** `test:unit` + `test:rls` (un altro utente non sovrascrive) + su stage: upload → reload → avatar visibile.

## 6. Favorites (#22)

- **Obiettivo:** salva/rimuovi campo preferito + lista (profilo o `/favorites`).
- **File:** `app/(app)/courts/[id]/page.tsx` (bottone salva), nuovo `components/court/favorite-button.tsx` + lista.
- **Migrazioni:** `024_favorites.sql` — `user_favorites(user_id, court_id, created_at, UNIQUE pair)`, RLS own-rows, FK `court_id → courts ON DELETE CASCADE`; solo `approved` salvabili (check in policy/trigger).
- **Seam TDD:** casi RLS in `tests/rls/assertions.sql` (blocco §33+: anon non legge, B non tocca i preferiti di A).
- **UI/@designer:** sì (toggle ottimistico, empty state).
- **Rischi:** bassi; coordinare con #66 se la lista riusa le card della home.
- **Effort:** 2 g. **Exit:** `npx supabase db reset` + `test:rls` verdi + su stage: salva da loggato → persiste al reload.

## Dipendenze / ordinamento

| Ordine | Item | Perché |
|---|---|---|
| 0 | #53 (018–021 su staging) | **fatto** 2026-11-12 |
| 1 | 6 Favorites | ✅ fatto (`024`) |
| 2 | 5 Avatar | ✅ fatto (`025`) |
| 3 | 4 History | ✅ fatto (sola lettura) |
| 4 | 1 Install/update | ✅ fatto |
| 5 | 2 Offline queue | **da fare**: prima della push, definisce la semantica di replay/errori |
| 6 | 3 Push delivery | **da fare**: serve Dashboard secrets + VAPID, il più operativo |

Con i residui Phase 1: #65/#66 (in corso) toccano `nearby-lobbies` e la home, stesse superfici di 6 → mettere 6 dopo il loro merge; #58 (retract/edit pending, rimandato qui) va prima o insieme a 6 (FK/cascade sui preferiti); #52 (GC orfani) si estende al bucket avatar in 5.

## Rischi trasversali

- **Free plan:** 2 progetti già occupati; storage 1 GB; niente transforms; DB 500 MB e pausa dopo inattività; realtime 200 connessioni (oggi 9 call-site `.channel(`, sotto soglia ma non aggiungerne a cuor leggero); email 2/h.
- **SW cache:** nomi `map-tiles-<provider>-v1` / `map-style-…-v1` con purge all'activate; bump solo se cambia il formato, mai per forzare un update (c'è già `skipWaiting`).
- **iOS:** niente install prompt (istruzioni manuali), push solo da PWA installata.
- **RLS/auth:** i flussi autenticati oggi sono coperti solo a mano — ogni item con scritture nuove aggiunge casi a `tests/rls/assertions.sql`, non solo smoke.

## Exit criteria di fase

- `npm run test:all` verde (`lint` + `lint:design` + `tsc` + `vitest` + `test:rls` + `playwright --project=e2e`) prima del merge.
- Live @tester su stage per item (dark-only, 360px + desktop, reload, console pulita, screenshot): install prompt + update toast (1); queue offline→online senza duplicati (2); push fra due utenti (3); history con dati veri (4); avatar + reload + isolamento utenti (5); preferiti persistiti + redirect anon (6).
- Staging-first sempre: PWA, push e offline non sono verificabili in locale.

## Cosa NON fare in Phase 2

i18n (#64), layout desktop, admin UI, Sentry/observabilità, rate-limit/WAF, SMTP dedicato, clustering marker (#42), PMTiles, estrazione OSM globale, toggle tema light (contraddice la regola dark-only), `supabase/functions` oltre `send-push`, ledger karma se la derivazione basta.

## Recipe di verifica

- Tutti: `npm run test:unit`, `npm run test:rls` (`npx supabase start` + docker), `playwright test --project=e2e`.
- 1: e2e con `beforeinstallprompt` mock + smoke manuale su stage.
- 2: unit outbox + `context.setOffline(true)` su stage.
- 3: `supabase functions deploy` su staging + E2E due browser; `scripts/db-check.mjs` per le code inviate.
- 4/5/6: esteso `tests/rls/assertions.sql` (§33 favorites, §34 avatars, §35 sport NULL, §36 retract/edit, §37 history) + `npm run test:rls`.

## Contraddizioni trovate (da correggere, non in Phase 2)

1. `docs/roadmap.md:22` "no in-app notification center" — falso: centro completo e shippato. Aggiornare a 🟡 con il solo gap delivery.
2. `docs/roadmap.md:29` e i ticket proposti "Theme" + Phase 0 #1/#2 (toggle light/dark) contraddicono AGENTS e design README (dark-only, vietato toggle e `dark:`). Marcare wontfix.
3. `docs/roadmap.md:23` "tile cache 1200/7d" vs `app/sw.ts` (600 OFM / 1200 OSM): precisare per provider.
