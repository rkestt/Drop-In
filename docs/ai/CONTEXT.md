# Drop-In: Street Edition — AI Context

## Cosa È

Drop-In è una PWA per trovare campetti sportivi pubblici (principalmente basket) e organizzare partite spontanee. Target: Roma. Dati estratti da OpenStreetMap. Sostituisce i gruppi WhatsApp con un'app centralizzata.

---

## Feature Principali

### 1. Mappa Interattiva (Browse-first)
- MapLibre GL JS con tile CARTO Voyager
- Marker circolari colorati per sport (basket, pallavolo, calcio, tennis, padel)
- Numeri sui marker = lobby attive
- Hover → popup nome + conteggio lobby
- Geolocalizzazione con pulsante "centra su di te" (punto blu pulsante)
- Filtri sport in alto (desktop) / inline (mobile)
- Visitabile senza auth

### 2. Dettaglio Campo (`/courts/[id]`)
- Nome, indirizzo, zona, superficie, numero canestri, sport
- Mini mappa con posizione
- Banner segnalazioni attive (canestro rotto, campo bagnato, ecc.)
- Card "Now": check-in attivi + lobby aperte
- Lista lobby imminenti con pulsanti join
- Azioni: Check-in, Preferiti, Segnala, Crea Lobby

### 3. Sistema Lobby
- Creazione: selezione campo, orario inizio, max giocatori
- Join/leave con un click
- Chat in tempo reale per partecipanti (Supabase Realtime)
- Auto-chiusura: 30 min dopo start_time (pg_cron)
- Notifiche push: creator quando qualcuno si unisce, reminder 15 min prima

### 4. Check-in / Check-out (GPS)
- Verifica GPS lato client (accuratezza ≤ 20m)
- Validazione server con PostGIS: distanza ≤ 50m dal campo
- Cooldown 5 min tra check-in sullo stesso campo
- +1 karma per check-in riuscito (cap a 100)
- Auto-checkout dopo 2h di inattività (cron job)

### 5. Segnalazioni Campi
- Categorie: broken_hoop, wet_court, lighting, occupied, other
- Auto-expiry dopo 48h
- Cron job notturno di pulizia

### 6. Preferiti
- Array `favorite_court_ids` su profiles
- Gestiti via API con service_role key
- Bottom sheet con campi recenti + preferiti

### 7. Sistema Karma & Ban
- Partenza: 90/100
- Check-in ok → +1 (max 100)
- No-show → -3
- Karma < 50 → ban automatico 7 giorni
- Cron job rimuove ban scaduti ogni ora

### 8. PWA (Serwist)
- Service worker in `app/sw.ts`
- Cache runtime: mappe (CacheFirst, 500 entries, 30gg), API campi (CacheFirst, 1h), chiamate DB (NetworkOnly)
- `skipWaiting: true`, `clientsClaim: true`, `navigationPreload: true`
- Manifest con `display: standalone`

---

## Tech Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Linguaggio | TypeScript 5 |
| Stili | Tailwind CSS v4 (spazio colore OKLCH, proprietà custom) |
| Font | Syne (display) + Source Sans 3 (body) |
| Mappa | MapLibre GL JS 5.x + CARTO Voyager |
| Backend/DB | Supabase (PostgreSQL + PostGIS + pg_cron + Realtime) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| PWA | Serwist 9.x |
| Icone | Lucide React |
| Utility | clsx + tailwind-merge |

---

## Database (PostgreSQL + PostGIS)

Tabelle principali:
- **courts** — campi sportivi con `location GEOGRAPHY(POINT, 4326)` indicizzato GiST
- **profiles** — utenti (1:1 con auth.users), karma, ban, preferiti
- **lobbies** — sessioni di gioco (status: open/in_progress/closed)
- **lobby_participants** — chi partecipa (UNIQUE lobby_id + user_id)
- **check_ins** — presenze verificate con GPS
- **court_reports** — segnalazioni (expiry 48h)
- **lobby_messages** — chat real-time per lobby
- **push_subscriptions** / **push_notifications** — notifiche web push

RLS: ogni tabella ha policy row-level per isolamento dati.

---

## Auth Flow

1. Middleware aggiorna sessione Supabase su ogni richiesta
2. Route `/dashboard/*` protette (redirect → `/?login=required`)
3. Login via LoginModal (email/password o Google OAuth)
4. Callback OAuth in `/api/auth/callback` scambia codice → sessione
5. Trigger DB `on_auth_user_created` crea profilo con karma=90

---

## Automazioni (pg_cron)

| Ogni 5 min | Notifiche lobby in partenza tra ~15 min |
|---|---|
| Ogni 15 min | Auto-chiusura lobby scadute, auto-checkout inattivi |
| Ogni ora | Rimozione ban scaduti |
| Giornaliero 02:00 | Pulizia report scaduti |
| Giornaliero 03:00 | Pulizia messaggi lobby chiuse da >24h |

---

## Dati

- 3.768 campi estratti da OSM (Overpass API) su Roma
- Script: `scripts/extract_osm.py` → `scripts/seed_courts.sql`
- Tipologie: basket, calcio, tennis, padel, pallavolo, skate, rugby, ping pong, bocce, cricket, baseball, hockey, golf, equitazione
- Zone normalizzate (Trieste, Parioli, Cinecittà, Centocelle, Aurelio, ecc.)

---

## API Routes (App Router)

| Route | Metodo | Scopo |
|---|---|---|
| `/api/courts` | GET | Campi filtrati per sport (edge runtime, cache 1h) |
| `/api/favorites` | GET/PATCH | Preferiti utente (service_role) |
| `/api/profile/avatar` | POST | Upload avatar |
| `/api/auth/callback` | GET | OAuth code exchange |

---

## Convenzioni Progetto

- **Route group**: `(app)` = pagine pubbliche, `(dashboard)` = auth required, `(landing)` = onboarding
- **Componenti**: in `components/` divisi per dominio (map/, lobby/, check-in/, karma/, auth/, etc.)
- **Lib**: `lib/supabase/` (client, server, middleware, admin, types), `lib/hooks/`, `lib/cache/`
- **Lingua UI**: Italiano
- **OpenSpec**: specifiche in `openspec/`, changelog guidato da `openspec/`
- **Middleware**: refresh sessione + protezione dashboard
