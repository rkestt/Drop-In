## Context

Drop-In: Street Edition è una PWA che mira a eliminare il caos nell'organizzazione dello sport amatoriale nei campetti pubblici. Il progetto parte da zero e necessita di un'architettura semplice ma scalabile per gestire dati geografici, stato in tempo reale e logica di gioco. Il vincolo principale è la velocità di sviluppo (MVP) bilanciata con l'affidabilità del sistema.

## Goals / Non-Goals

**Goals:**
- Fornire una mappa interattiva dei campetti pubblici con dati aggiornati.
- Permettere il check-in GPS-based per verificare la presenza fisica sul campo.
- Implementare un Karma Score per incentivare l'affidabilità.
- Abilitare la segnalazione crowdsourced dello stato dei campi.
- Supportare la creazione di lobby di gioco in tempo reale.
- Essere deployabile in container Docker per qualsiasi ambiente.

**Non-Goals:**
- Sviluppo di app native iOS/Android (solo PWA).
- Sistema di pagamento o monetizzazione.
- Gestione di tornei, classifiche o leghe strutturate.
- Copertura nazionale immediata (focus su Roma, zone San Lorenzo / Piazza Bologna).
- Chat in-app tra utenti (si usa contact sharing esterno).

## Decisions

- **Frontend: Next.js App Router**: Scelto per le prestazioni SSR/SSG, il supporto PWA nativo e l'ottima SEO locale necessaria per il lancio iper-locale.
- **Backend: Supabase**: PostgreSQL + PostGIS gestiti managed riducono il tempo di setup ops. Realtime è incluso per aggiornamenti live sulle lobby e lo stato dei campi.
- **Geolocalizzazione: Browser GPS + PostGIS**: Il check-in usa la Geolocation API del browser. Il raggio di validazione è **50 metri** dal campo (validato server-side con `ST_DWithin`). Se il segnale GPS è scarso (>20m accuracy), il frontend chiede all'utente di spostarsi verso il centro del campo. È previsto un **cooldown di 5 minuti** tra check-in consecutivi dello stesso utente sullo stesso campo per mitigare abuso.
- **Containerizzazione: Docker + Docker Compose**: Necessario per garantire consistenza tra sviluppo e produzione, dato che il team potrebbe includere collaboratori esterni.
- **Mappatura dati: Python + OSM Overpass API**: Script one-off per estrarre i dati iniziali, non un servizio continuo. I dati vengono inseriti in bulk nel database Supabase.
- **Autenticazione: Supabase Auth (Email + Google OAuth)**: Evita di gestire password e sessioni manualmente. Integrazione immediata con il database. Al lancio nessun altro provider social per ridurre la complessità.
- **Stato Karma: Tabella dedicata, valutazione ban via Edge Function**: Ogni check-in mancato decrementa il punteggio di 3. Il punteggio iniziale per nuovi utenti è **90**. La valutazione del ban settimanale (soglia < 50) è gestita da una **Supabase Edge Function** (non trigger DB), coerentemente con l'architettura di scheduling.
- **Checkout automatico: 2 ore di inattività**: Utenti rimossi automaticamente dai presenti dopo 2 ore senza attività.
- **Chiusura lobby e valutazione Karma**: Schedulata tramite **`pg_cron` + stored procedure PostgreSQL** ogni 15-30 minuti. Le stored procedure garantiscono atomicità transazionale e idempotenza senza rischio di timeout HTTP.
- **Distanza geografica**: `ST_DWithin` su tipo `geography` per massima accuratezza. Indice spaziale GiST obbligatorio su `courts` per query entro 5km.
- **Indici e vincoli DB**: Indici su `lobbies(status, court_id)`, `check_ins(user_id, checked_out_at)`, `profiles(banned_until)`, `court_reports(court_id, created_at)`. FK esplicite e unique constraint `lobby_participants(lobby_id, user_id)` per prevenire doppie iscrizioni.
- **Push notifications**: Sì, notifiche base (lobby inizia tra 15 min, nuovo partecipante alla tua lobby).
- **PWA Offline cache**: UI shell + dati campi in JSON + map tiles limitate. Nessun caching massivo della mappa per non esplodere lo storage utente.
- **Ban scope**: Utente bannato vede solo la mappa. Non può joinare lobby, crearle, fare check-in o inviare report.
- **Frontend Design Skills**: Stack di skill attive per UI/UX del progetto:
  - `frontend-design` — UI production-grade, evita AI slop generico
  - `huashu-design` — HTML hi-fi prototype, mockup mobile, export GIF/MP4
  - `impeccable` — UI/UX audit, polish, redesign, accessibility check
  - `web-design-guidelines` — validazione UI contro best practices web
- **Design System**: Documentato in `specs/frontend-design/spec.md`. Direzione "Concrete & Courts" — estetica urbana/autentica con accent ruggine OKLCH, tipografia Syne + Source Sans 3, layout mobile-first full-bleed, componenti flat senza ombre pesanti, motion con ease-out-quart. Vincoli anti-slop e WCAG 2.1 AA.
- **App Router Structure**: Next.js 14 App Router con route groups per organizzazione. `(app)` per pagine pubbliche (mappa, browse), `(dashboard)` per aree autenticate (profilo, lobby). API routes solo per webhook e health check — tutto il resto via Supabase client/server.
- **Data Fetching**: Server Components di default per dati statici/initial (lista campi, dettaglio campo). Client Components con `useEffect` solo per: geolocalizzazione browser, Supabase Realtime subscriptions, MapLibre interattività. Supabase SSR client (`@supabase/ssr`) per sessione auth in Server Components. RSC → fetch dati iniziali → passa a Client Component per interattività real-time.

## Risks / Trade-offs

- **[Risks] GPS spoofing per check-in falsi** → **Mitigazione**: Validazione lato server con PostGIS; nel MVP non si implementa anti-spoofing avanzato (livello di priorità basso).
- **[Risks] Densità utenti insufficiente al lancio** → **Mitigazione**: Lancio iper-locale mirato; se la densità è bassa, l'app appare "morta". Si parte con zone ad alta affluenza nota.
- **[Risks] Costo Supabase con Realtime su larga scala** → **Mitigazione**: Per l'MVP il piano free/gratuito è sufficiente; in caso di scaling si valuta migrazione a self-hosted o altro provider.
- **[Risks] Aggiornamento dati OSM non in tempo reale** → **Mitigazione**: Il crowdsourcing degli utenti compensa la staticità dei dati iniziali.
- **[Trade-offs] Semplicità vs Funzionalità**: Si sacrificano feature come chat e notifiche push complesse per mantenere l'MVP snello e testabile in poche settimane.

## Migration Plan

- Non applicabile (progetto ex-novo). Il deployment avverrà su Vercel (frontend) e Supabase Cloud (backend).

## Open Questions

- Quali provider OAuth sono necessari per il lancio? → **Deciso**: Solo Google + Email.
- È richiesta una moderazione umana per le segnalazioni sullo stato dei campi? (Ipotesi: no per l'MVP, affidamento su karma).
