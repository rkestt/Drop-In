# Rome Launch Readiness — context di pianificazione

Grilling session post-MVP. Obiettivo dichiarato da Andrea: **portare Drop-In a tutta Roma**, solo scope MVP base, niente feature nuove. Zero costo finché non validato.

## Decisioni prese (Q&A grilling)

| # | Decisione | Dettaglio |
|---|-----------|-----------|
| Q1 | Target = tutta Roma, solo MVP | Niente feature nuove finché non in stage |
| Q3 | Deploy: stage su Vercel + Supabase Cloud free | Prod su VPS DOPO validazione; stage migrerà sul VPS. Nota: Supabase Cloud→self-host è migrazione vera (dump+auth+storage), valutare allora paid $25/mese vs VPS |
| Q4 | GDPR: minimo vitale pre-lancio | Privacy policy semplice + consenso GPS alla registrazione + retention job SQL (anonimizza lat/lng check_ins chiusi >30gg). Full compliance rimandata |
| Q5/Q6 | Check-in: doppio binario | (a) GPS individuale RESTA per presenza su mappa, senza karma; (b) karma/no-show deciso dall'APPELLO del leader (leader segna presenti/assenti). Leader non presentato: morte lobby automatica via cron a start_time+15min senza leader-check, niente karma -3 al leader alla prima volta (grazia) |
| Q7 | Push notifications IN SCOPE attivo | Non solo verifica: revisionare, migliorare e FINIRE le push — devono funzionare davvero in staging |
| Anti-spoofing | Rischio accettato al lancio | Niente mock-location detection; eventuale mitigazione futura: rifiuto accuracy>100m + distanza server-side haversine check-in↔court (schema ha già `accuracy`) |
| Q8 | Fix minimo mappa: RIMANDATO | In todo #3 (viewport RPC PostGIS). L'utente ha deciso di pensarci dopo, non blocca la pianificazione launch |

## Todo già creati (fuori piano)

- Todo #1: Redesign data layer — qualità dati OSM + query efficienti (rimandato, brainstorming architetturale)
- Todo #2: GDPR minimo vitale

## Fatti verificati (codice attuale)

### DB
- 7 tabelle: courts, profiles, lobbies, lobby_participants, check_ins, court_reports, push_subscriptions/push_notifications
- RLS su tutto, policy read-pubblico / write-owner
- PostGIS `location GEOGRAPHY` + GIST index su courts (ora inutilizzato)
- 4 pg_cron: auto-close-lobbies, auto-checkout, remove-expired-bans, archive-old-reports
- Migration 003: venue_type + sport aggiunti a courts

### Dati
- `scripts/courts.json`: **10.130 cortili** OSM per tutta Roma (bbox 41.75,12.30–41.98,12.65)
- Qualità scarsa: 6.364 senza sport, ~9.500 nomi generici ("Spazio aperto"), venue_type green_space/playground dominanti
- seed_courts.sql pronto (10k righe)

### Mappa
- MapLibre, centro Roma zoom 14
- **BUG strutturale**: `select("*").limit(100)` senza query spaziale → primi 100 cortili arbitrari del DB, non del viewport. A scala Roma è inusabile. Fix rimandato nel redesign data layer (todo #1) ma qualcosa serve comunque per lo stage.

### Auth
- Email/password (`signInWithPassword`) + Google OAuth (`signInWithOAuth provider google`)
- supabase/config.toml: google external abilitato via env NEXT_PUBLIC_GOOGLE_CLIENT_ID

### Realtime
- Usato in: ban-banner, lobby-list, notification-toast, reported-courts-indicator
- Wiki: WebSocket Realtime ROTTO su Supabase locale → mai verificato davvero. Su cloud dovrebbe funzionare: DA VERIFICARE in staging (chiude task 11.4 dell'MVP).

### Debito noto
- Zero test framework
- Task 11.4 MVP aperto: verifica e2e in staging (mai fatto)
- GDPR assente (vedi decisione Q4)

## Domande ancora aperte (grill in corso)

- Anti-abuse: GPS spoofing / karma gaming — rischio accettato o mitigazione minima?
- Push notifications: in scope lancio o defer?
- Fix mappa minimo per stage (viewport query) o si accetta limit(100) finché non c'è il redesign?
