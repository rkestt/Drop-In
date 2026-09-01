# Drop-In recon — Mode: PLAN (wayfinder map "app in bella funzionante")

## 1. Struttura
- Route groups: `app/(app)/` public (map page, courts/[id]), `app/(dashboard)/` auth (lobbies, profile).
- Root layout `app/layout.tsx`, PWA service worker `app/sw.ts`.
- API route: SOLO `app/api/auth/callback` (Supabase OAuth). Nessuna API custom.
- `lib/supabase/`: client.ts, server.ts, middleware.ts, database.types.ts.
- 20 component in `components/` (map, lobby, check-in, karma, report, notifications, auth, profile).

## 2. Supabase
- Migrazioni: `001_initial_schema.sql` (courts, profiles, lobbies, lobby_participants, check_ins, court_reports, push_subscriptions, push_notifications, RLS, cron, trigger karma/ban/checkin cooldown+distanza 50m), `002_push_notification_triggers.sql` (notify start/join/karma-loss), `003_add_venue_and_sport.sql`.
- NESSUN `supabase/seed.sql`. Seed manuale in `scripts/seed_courts.sql` (~10k INSERT courts, Roma area, venue_type playground/park).
- Schema solido, RLS ben fatto, PostGIS+pg_cron abilitati. Cooldown check-in 5min, distanza 50m, karma start 90.
- `supabase/config.toml` presente. DB live non verificato (senza Docker/dotenv).

## 3. Stato build — IMPOSSIBILE verificare
- **`node_modules` ASSENTE** — `npx tsc` e `npm run lint` falliscono: "tsc not found", "eslint: command not found". Serve `npm install` primo.
- NOTA package-lock: `next@15.5.15` risolto ma package.json chiede `^15.1.0`; `eslint-config-next@16.2.4` (maggiore 16) vs next 15 — mismatch potenziale su lint.
- Nessun `.env*` presente (serve NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).

## 4. TODO/FIXME/stub
- `components/notifications/push-provider.tsx:19` — placeholder esplicito: registerPush non fa nulla, commento "VAPID public key from env... placeholder for subscription flow". Push sostanzialmente stub, silenzioso.
- placeholder minore: input email/password/nickname/report (UI normali).

## 5. Feature incomplete/rotte
- **next.config.js BUG**: ha DUE `module.exports`. Il secondo `module.exports = serwistConfig;` SOVRASCRIVE il primo che applica `withSerwist`. → produzione esporta solo `{swSrc,swDest}`, PWA config mai applicata. Serwist disattivo in build.
- **Map `page.tsx:47`**: `.from("courts").select("*").limit(100)` — ma seed ha ~10k courts. Mappa mostra solo 100 campi. Rotto su scala.
- **LobbiesPage `(dashboard)/lobbies/page.tsx`**: titolo "Le tue lobby" ma query `.eq("status","open")` senza filtro user → elenca TUTTE le open lobby, non quelle dell'utente. Incoerenza titolo/dati.
- **Push notification**: sia DB (notify_user) che client (push-provider) stub per delivery reale — richiede Edge Function con VAPID. Notification toast/provider presenti ma back-end mancante.
- **check-in / fitness**: check-in trigga richiede distanza GPS 50m — in dev/test senza GPS reale fallisce sempre (Raisa exception).

## 6. openspec/
- NESSUN change aperto. Solo `changes/archive/2026-05-01-drop-in-mvp/` (archiviato: court-mapping, court-status-reports, frontend-design, karma-system, match-lobby, real-time-checkin, user-auth). `config.yaml` spec-driven vuoto (no context/rules).

## 7. Rischi top 5
1. **`npm install` + build mai girati** — stato compile/lint sconosciuto; version mismatch deps (eslint-config-next 16 vs next 15).
2. **next.config.js `module.exports` doppio** — rompe PWA/serwist in produzione silenziosamente.
3. **Map limit(100)** — solo 100/10k courts visibili, mappa essenzialmente incompleta.
4. **Push notifications stub** — feature dichiarata ma non funzionante (no VAPID, no Edge Function, provider fa no-op).
5. **Lobbies page dati sbagliati vs titolo** + check-in distance 50m friendly solo con GPS reale (dev/test rotto).

## Primo file per prossimo agente (BUILD)
- `next.config.js` (fix doppio module.exports) → poi `npm install`, correggere versioni deps, `npm run build` per scoperte compile/lint reali, poi `page.tsx` map limit(100).

## Wiki notes
- FONTE: next.config.js double module.exports (bug attivo); map limit(100) vs 10k seed; push stub; no node_modules/env.
