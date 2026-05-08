# Drop-In — Architettura Tecnica

## Stack

| Livello | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Stile | Tailwind CSS v4 (CSS custom properties) |
| Mappa | MapLibre GL JS + tile CARTO Voyager |
| Backend | Supabase (PostgreSQL + PostGIS + pg_cron + Realtime) |
| PWA | Serwist (service worker, caching map tiles) |
| Auth | Supabase Auth (email/password + Google OAuth) |

---

## 1. Struttura file system

```
app/
  layout.tsx                     # Root layout (font, ToastProvider, PWA)
  (app)/                         # Route group: pagine pubbliche
    layout.tsx                   # Nav mobile con Mappa/Profilo
    page.tsx                     # Home: mappa + sidebar lobby
    courts/[id]/page.tsx         # Dettaglio campo
  dashboard/                     # Route group: pagine protette
    layout.tsx                   # Header "Indietro" (profilo, lobby)
    profile/page.tsx
    lobbies/page.tsx
  api/auth/callback/route.ts     # OAuth callback Supabase
  api/profile/avatar/route.ts    # Upload avatar (storage RLS)
  sw.ts                          # Service worker Serwist

components/
  map/          court-map.tsx, court-mini-map.tsx
  lobby/        create-lobby-sheet, lobby-list, lobby-join-card, lobby-chat, leave-lobby-button
  check-in/     check-in-button, check-in-sheet, checkout-button
  karma/        karma-indicator, ban-banner, ban-banner-wrapper
  auth/         login-modal, login-prompt
  report/       report-button, report-sheet, reported-courts-indicator
  notifications/ push-provider, toast-provider, notification-toast
  ui/           button, input, badge, bottom-sheet

lib/supabase/
  client.ts      # createBrowserClient (client components)
  server.ts      # createServerClient con cookie headers (server components)
  middleware.ts  # updateSession: refresh + protezione route /dashboard
  database.types.ts  # Generati da Supabase, tutti i tipi TABLES/ROWS

supabase/migrations/
  001_initial_schema.sql   # Tabelle, RLS, trigger, cron, funzioni
  002_push_notification_triggers.sql
  003_storage_avatars.sql
  004_lobby_messages.sql
  0003_add_zone_column.sql, 003_add_venue_and_sport.sql

scripts/
  extract_osm.py      # Overpass API → courts.json + seed_courts.sql
  enrich_courts.py
  seed_courts.sql
```

---

## 2. Flusso di autenticazione

```
Browser → middleware.ts (ogni richiesta)
  ├─ createServerClient + cookie Supabase
  ├─ supabase.auth.getUser() — refresh token se scaduto
  ├─ protezione /dashboard/* → redirect a /?login=required
  └─ NextResponse.next()

Login con Google:
  LoginModal → supabase.auth.signInWithOAuth({ google })
    → redirect a /api/auth/callback?code=xxx

Callback /api/auth/callback:
  exchangeCodeForSession(code)
    → set cookie session
    → redirect /
```

**Client auth:** `createClient()` (browser) legge le session cookie automaticamente.
**Server auth:** `createClient()` (server components) usa i cookie headers per leggere la sessione lato server.

---

## 3. Routing e protezione

```
middleware.ts matcher: /((?!_next/static|...|api/).*)
  ├─ Tutte le pagine passano da updateSession
  ├─ /dashboard/* → richiede utente loggato, altrimenti redirect /
  └─ return supabaseResponse

app/(app)/layout.tsx     → URL /, /courts/[id]  (pubblici, nav Mappa/Profilo)
app/dashboard/layout.tsx → URL /profile, /lobbies (protetti, header "Indietro")
```

---

## 4. Mappa — CourtMap (client component)

```
init (useEffect una volta):
  new maplibregl.Map({ style: CARTO Voyager tiles })
  ↓ on('load')
  addSource('courts', geojson)
  addLayer('courts-circle')  → cerchi colorati per lobby count
  addLayer('courts-label')   → numeri lobby (>0)
  addControl NavigationControl

GeoJSON source aggiornato quando cambiano courts/lobbyCounts
Paint properties aggiornati per reportedCourtIds

Click su cerchio → navigate /courts/{id}
Hover → maplibregl.Popup con nome + count lobby

Geolocalizzazione:
  navigator.geolocation.getCurrentPosition()
    → flyTo centro + marker blu pulsante
    → errore: messaggio "Centro su Roma"
```

**Cache PWA:** service worker con Serwist (`CacheFirst` + `ExpirationPlugin` 500 tile / 30gg) per tile OSM.

---

## 5. Creazione e gestione lobby

```
HomePage carica lobbies (status='open') + courts
  → LobbyList (client): subscribe realtime su lobbies + lobby_participants
  → LobbyRow inline in homepage

CourtPage carica lobbies del campo
  → LobbyJoinCard (per ogni lobby): join/leave + stato
  → LobbyChat (se utente loggato): messaggi in tempo reale

CreateLobbySheet (client component):
  1. Controlla profile: banned_until, karma_score
  2. supabase.from('lobbies').insert({ court_id, creator_id, start_time, max_players })
  3. Trigger DB: check_user_not_banned() → RAISE EXCEPTION se ko
  4. reload

Join/Leave:
  LobbyJoinCard → supabase.from('lobby_participants').insert/delete
  Trigger: notify_participant_joined() → push_notifications (creatore avvisato)
```

---

## 6. Sistema Karma

```
 Profili creati automaticamente: handle_new_user() → karma_score=90

 Check-in verificato:
   enforce_check_in_distance() → PostGIS ST_DWithin(50m)
   enforce_check_in_cooldown() → 5 minuti stesso campo
   increment_karma_on_check_in() → +1 (max 100)

 Missed check-in (lobby chiusa):
   trigger_decrement_karma_on_close → -3 per ogni partecipante
   senza check-in attivo nella lobby

 Banned:
   enforce_ban_on_low_karma() → se karma < 50 → banned_until = NOW() + 7 days
   check_user_not_banned() → blocca insert su lobby_participants/lobbies

 Cron:
   remove_expired_bans() → hourly
   auto_close_lobbies() → ogni 15 min (start_time + 30min)
   auto_checkout() → ogni 15 min (checked_in_at + 2h)
```

---

## 7. Check-in / Check-out

```
Check-in flow:
  1. GPS: navigator.geolocation.getCurrentPosition (high accuracy, 20m max)
  2. Validazione client: accuracy ≤ 20m
  3. supabase.from('check_ins').insert({ user_id, court_id, lat, lng, accuracy })
  4. Server-side trigger: distanza 50m PostGIS, cooldown 5min, karma +1

Check-out flow:
  CheckoutButton → UPDATE check_ins SET status='checked_out'
  Auto-checkout: cron ogni 15min per check_in_at > 2h
```

---

## 8. Segnalazioni campi

```
ReportSheet → supabase.from('court_reports').insert({
  court_id, user_id, category, description, expires_at: +48h
})

Court detail page:
  Fetch court_reports attivi (expires_at > now)
  → Alert banner se count > 0

Cron: archive_old_reports() ogni notte → DELETE where expires_at < now
```

---

## 9. Chat delle lobby

```
LobbyChat:
  on mount: supabase.from('lobby_messages').select('*, profiles(nickname, avatar_url)')
  realtime: supabase.channel(`lobby-chat-{lobbyId}`)
    → postgres_changes INSERT su lobby_messages WHERE lobby_id=eq.{id}
    → fetch full message + profile → append to state

  Send: supabase.from('lobby_messages').insert({ lobby_id, user_id, content })
  Consecutive messages grouped by same user_id

  Unread count: se scroll non è in basso → incrementa counter
  Auto-scroll quando sono in basso
```

---

## 10. Database — tabelle e relazioni

```
auth.users (Supabase gestito)
  ├── profiles (1:1, ON DELETE CASCADE)
  │     karma_score, banned_until
  ├── lobbies (1:N, creator_id)
  ├── lobby_participants (N:1)
  ├── check_ins (N:1)
  ├── court_reports (N:1)
  └── push_subscriptions (1:N)

courts
  id, osm_id (UNIQUE), name, address, lat, lng
  surface_type, hoop_count, status, zone, sport, venue_type
  location GEOGRAPHY(POINT,4326) → trigger auto-populate

lobbies
  id, court_id → courts, creator_id → users
  start_time, max_players, status ('open'|'in_progress'|'closed')

lobby_participants
  lobby_id → lobbies, user_id → users
  UNIQUE(lobby_id, user_id) → impossibile iscriversi due volte

lobby_messages
  lobby_id → lobbies, user_id → users
  content, created_at

check_ins
  user_id → users, court_id → courts, lobby_id → lobbies (nullable)
  lat, lng, accuracy, status ('active'|'checked_out')
  checked_in_at, checked_out_at

court_reports
  court_id → courts, user_id → users
  category, description, expires_at
```

---

## 11. RLS Policies

| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| courts | everyone | — | — | — |
| profiles | everyone | trigger | own row | — |
| lobbies | everyone | auth (creator) | auth (creator) | — |
| lobby_participants | everyone | auth | — | own row |
| check_ins | everyone | auth | own row | — |
| court_reports | everyone | auth | — | — |
| push_subscriptions | own | own | own | own |
| push_notifications | own | — | — | — |

---

## 12. Cron jobs (pg_cron)

| Job | Frequenza | Funzione |
|---|---|---|
| auto-close-lobbies | `*/15 * * * *` | Chiude lobbies scadute (start + 30min) |
| auto-checkout | `*/15 * * * *` | Check-out automatico dopo 2h |
| remove-expired-bans | `0 * * * *` | Rimuove ban scaduti |
| archive-old-reports | `0 2 * * *` | Elimina segnalazioni expire |
| notify-lobby-starting-soon | `*/5 * * * *` | Inserisce in push_notifications per lobby tra 15min |

---

## 13. PWA / Offline

```
app/sw.ts (Serwist):
  skipWaiting + clientsClaim
  precache: app shell + static assets
  runtimeCaching:
    - defaultCache: navigation, static, fonts
    - map-tiles: CacheFirst, maxEntries=500, maxAgeSeconds=30gg

manifest.json: standalone display, theme #ffffff
Service worker registrato in layout.tsx tramite @serwist/next
```

---

## 14. Flusso dati completo — dalla richiesta alla risposta

```
Utente apre / (home)
  ↓
middleware.ts → updateSession → getUser() → ritorna supabaseResponse
  ↓
AppRouter carica layout + page.tsx
  ↓
HomePage (client component):
  1. supabase.auth.getUser() → setUser
  2. supabase.from('courts').select('*') → setCourts (mappa)
  3. supabase.from('lobbies').select('*, lobby_participants(count)')
       .eq('status','open') → setLobbies (sidebar)
  4. Subscribe: supabase.channel('lobbies').on('postgres_changes', ...)
  ↓
MapLibre renderizza cerchi sui courts
Sidebar renderizza LobbyRow cards
  ↓
Utente clicca una lobby → /courts/{court_id}
  ↓
CourtPage (Server Component):
  createClient() server → fetch court, lobbies, reports
  ↓
Utente fa "Entra" → LobbyJoinCard client:
  1. Controlla profile (ban, karma)
  2. supabase.from('lobby_participants').insert({ lobby_id, user_id })
  3. Trigger: notify_participant_joined() → push_notifications
  4. Realtime aggiorna LobbyList su tutti i client
  ↓
Utente fa check-in → CheckInSheet:
  1. navigator.geolocation.getCurrentPosition()
  2. supabase.from('check_ins').insert({ lat, lng, accuracy })
  3. Trigger: distance check PostGIS, cooldown, karma +1
  4. Realtime aggiorna count su CourtPage
```

---

## 15. Dipendenze chiave

```
@supabase/ssr          SSR cookie management
@supabase/supabase-js  Client lib
maplibre-gl            Map rendering (SSR-safe: dynamic import)
@serwist/next          PWA service worker
next                   15, App Router, standalone output
tailwindcss v4         CSS custom properties + utility classes
lucide-react           Icone
```

---

## 16. Configurazione locale

```bash
npm install
npx supabase start          # Docker: API :54321, DB :54322, Studio :54323
# Copia URL + anon key da supabase status in .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
npx supabase db reset        # Applica migrations + PostGIS + pg_cron
npm run dev                  # Next.js :3000
```