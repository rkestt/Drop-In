## 1. Setup Progetto

- [x] 1.1 Inizializzare repository Next.js 14+ con App Router e TypeScript
- [x] 1.2 Configurare Docker e Docker Compose per sviluppo locale
- [x] 1.3 Configurare progetto Supabase (locale e cloud) con estensione PostGIS
- [x] 1.4 Installare MapLibre GL JS e dipendenze PWA
- [x] 1.5 Configurare variabili ambiente (.env.local / .env.production)
- [x] 1.6 Attivare skill frontend: `frontend-design`, `huashu-design`, `impeccable`, `web-design-guidelines`
- [x] 1.7 Scrivere `specs/frontend-design/spec.md` con design system completo (colore OKLCH, tipografia, spacing, componenti, motion, a11y)
- [x] 1.8 Configurare Google Fonts (Syne, Source Sans 3) e CSS variables nel progetto Next.js
- [x] 1.9 Creare componenti base UI (Button, Input, Badge, BottomSheet) conformi allo spec
- [x] 1.10 Validare componenti base con `web-design-guidelines`
- [x] 1.11 Strutturare cartelle App Router: `(app)/page.tsx`, `(app)/courts/[id]/page.tsx`, `(dashboard)/profile/page.tsx`, `(dashboard)/lobbies/page.tsx`, layout root con provider Supabase
- [x] 1.12 Implementare pattern fetching: Server Components per dati iniziali (Supabase SSR client), Client Components wrapper per Realtime/MapLibre/interattività
- [x] 1.13 Configurare Supabase SSR (`@supabase/ssr`) per auth in Server Components e middleware route protection

## 2. Database e Schema

- [x] 2.1 Creare tabella `courts` con campi: id, osm_id, name, address, lat, lng, surface_type, hoop_count, created_at, updated_at, status (PostGIS geography type per lat/lng)
- [x] 2.2 Creare tabella `profiles` con campi: id, user_id, nickname, avatar_url, karma_score, banned_until, created_at, updated_at
- [x] 2.3 Creare tabella `lobbies` con campi: id, court_id, creator_id, start_time, max_players, status (open/in_progress/closed), created_at, updated_at
- [x] 2.4 Creare tabella `lobby_participants` con campi: id, lobby_id, user_id, joined_at
- [x] 2.5 Creare tabella `check_ins` con campi: id, user_id, court_id, lobby_id (nullable), lat, lng, accuracy, status (active/checked_out), checked_in_at, checked_out_at
- [x] 2.6 Creare tabella `court_reports` con campi: id, court_id, user_id, category, description, created_at, expires_at
- [x] 2.7 Scrivere script Python per estrarre campetti da OpenStreetMap (Overpass API) e popolare tabella `courts`
- [x] 2.8 Eseguire importazione iniziale dati OSM per zona San Lorenzo / Piazza Bologna
- [x] 2.9 Aggiungere indice spaziale GiST su `courts` per query `ST_DWithin`
- [x] 2.10 Aggiungere indici su `lobbies(status, court_id)`, `check_ins(user_id, checked_out_at)`, `court_reports(court_id, created_at)`, `profiles(banned_until)`
- [x] 2.11 Aggiungere vincoli FK (`lobbies.court_id → courts.id`, `check_ins.lobby_id → lobbies.id`) e unique constraint `lobby_participants(lobby_id, user_id)`
- [x] 2.12 Configurare `pg_cron` su Supabase per job periodici (chiusura lobby, auto-checkout, rimozione ban, archiviazione report)

## 3. Autenticazione

- [x] 3.1 Integrare Supabase Auth nel frontend (provider Email e Google OAuth)
- [x] 3.2 Implementare flusso "Browse-first": mappa visibile senza login, blocco solo su join/check-in
- [x] 3.3 Creare pagina/login modale con gestione sessione JWT persistente
- [x] 3.4 Implementare aggiornamento nickname e avatar nel profilo utente
- [x] 3.5 Gestire propagazione nickname aggiornato nelle lobby attive

## 4. Mappa e Campi

- [x] 4.1 Implementare pagina principale con mappa MapLibre centrata su posizione utente
- [x] 4.2 Visualizzare marker dei campetti recuperati da Supabase entro 5km (query PostGIS ST_DWithin)
- [x] 4.3 Implementare pan/zoom con re-fetch dinamico dei campi visibili
- [x] 4.4 Creare scheda dettaglio campo (nome, indirizzo, superficie, canestri, segnalazioni attive)
- [x] 4.5 Gestire fallback se geolocalizzazione negata (centro su Roma / San Lorenzo)
- [x] 4.6 Aggiungere stati di caricamento (loading spinner) e stato vuoto (nessun campo nelle vicinanze)
- [x] 4.7 Validare mappa e UI principale con `web-design-guidelines`
- [x] 4.8 Creare mockup hi-fi schermate principali (mappa, lobby, profilo) con `huashu-design`
- [x] 4.9 Audit accessibilità mappa e touch target (WCAG 2.1 AA) con `impeccable`
- [x] 4.10 Polish animazioni mappa e transizioni pagina con `impeccable animate`

## 5. Match Lobby

- [x] 5.1 Implementare creazione lobby (selezione campo, orario inizio, numero massimo giocatori)
- [x] 5.2 Implementare unione a lobby con controllo limite massimo partecipanti
- [x] 5.3 Implementare lista lobby attive entro 5km, ordinate per distanza, filtrate per stato "non iniziate"
- [x] 5.4 Implementare pulsante "Lascio il campo" per uscita manuale dalla lobby
- [x] 5.5 Implementare chiusura automatica lobby 30 min dopo orario inizio (logica in job `pg_cron` + stored procedure PostgreSQL)
- [x] 5.6 Aggiungere indicatori di stato lobby (aperta, in corso, chiusa)

## 6. Real-Time Check-In

- [x] 6.1 Implementare logica check-in GPS: validazione distanza < 50m con accuracy <= 20m (ST_DWithin server-side)
- [x] 6.2 Implementare avviso se accuracy GPS scarsa (>20m), chiedendo spostamento verso centro campo
- [x] 6.3 Implementare cooldown check-in: stesso utente non può richeckare sullo stesso campo entro 5 minuti
- [x] 6.4 Implementare aggiornamento in tempo reale contatore giocatori presenti (Supabase Realtime, contatore ricalcolato con COUNT per evitare desync)
- [x] 6.5 Implementare checkout manuale
- [x] 6.6 Implementare checkout automatico dopo 2 ore di inattività (job `pg_cron` + stored procedure)
- [x] 6.7 Gestire errore check-in (utente troppo lontano, GPS negato, rete assente)

## 7. Karma System

- [x] 7.1 Implementare assegnazione Karma iniziale 90 a nuovi utenti
- [x] 7.2 Implementare incremento Karma (+1) su check-in verificato dopo join lobby
- [x] 7.3 Implementare decremento Karma (-3) su mancato check-in alla chiusura lobby
- [x] 7.4 Implementare logica ban: se Karma < 50, utente non può joinare/creare lobby per 7 giorni
- [x] 7.5 Implementare rimozione ban automatica dopo 7 giorni
- [x] 7.6 Implementare visualizzazione Karma nel profilo (indicatore alto/medio/basso)
- [x] 7.7 Implementare notifica all'utente quando Karma scende o ban viene applicato
- [x] 7.8 Aggiungere scenari errore: calcolo Karma fallito, utente bannato tenta azione

## 8. Court Status Reports

- [x] 8.1 Implementare invio segnalazione con categorie predefinite (Canestro rotto, Campo bagnato, Illuminazione, Occupato, Altro)
- [x] 8.2 Visualizzare segnalazioni recenti (< 24h) nella scheda dettaglio campo
- [x] 8.3 Implementare auto-archiviazione segnalazioni dopo 48 ore
- [x] 8.4 Aggiungere indicatore visivo su mappa per campi con segnalazioni attive
- [x] 8.5 Gestire errore invio segnalazione (rete assente, categoria mancante)

## 9. Push Notifications

- [x] 9.1 Configurare Supabase / service worker per notifiche push base
- [x] 9.2 Implementare notifica "Lobby inizia tra 15 minuti" ai partecipanti
- [x] 9.3 Implementare notifica "Nuovo partecipante nella tua lobby" al creatore
- [x] 9.4 Implementare notifica "Hai perso 3 punti Karma" su mancato check-in

## 10. PWA e Offline

- [x] 10.1 Configurare Web App Manifest (icona, nome, theme, display standalone)
- [x] 10.2 Implementare Service Worker con cache strategica
- [x] 10.3 Cache offline: UI shell + dati campi JSON + tile mappa limitate
- [x] 10.4 Gestire fallback offline per check-in e join lobby (coda locale o messaggio errore)

## 11. Deploy e DevOps

- [x] 11.1 Configurare deploy frontend su Vercel
- [x] 11.2 Configurare deploy backend su Supabase Cloud
- [x] 11.3 Documentare procedura di deploy nel README
- [ ] 11.4 Verificare funzionamento end-to-end in ambiente di staging
