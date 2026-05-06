## Why

Organizzare una partita di sport di strada è un caos: gruppi WhatsApp dispersivi, campi occupati o in cattive condizioni, e l'incertezza di trovare abbastanza giocatori. Drop-In: Street Edition risolve questo problema con una PWA a frizione zero che mostra in tempo reale chi sta giocando, dove e a che ora, eliminando la necessità di download pesanti o burocrazie. Il lancio è mirato su aree ad alta densità (es. San Lorenzo / Piazza Bologna a Roma) per garantire densità e affidabilità fin da subito.

## What Changes

- Creazione di una Progressive Web App (PWA) con Next.js (App Router) per il frontend.
- Integrazione di Supabase (PostgreSQL + PostGIS) come backend per la gestione dei dati geografici e dello stato in tempo reale.
- Sviluppo di un sistema di mappatura automatica dei campetti pubblici tramite script Python e OpenStreetMap.
- Implementazione di un sistema di check-in GPS-based per la verifica della presenza fisica sul campo.
- Introduzione di un Karma Score per penalizzare gli utenti che prenotano ma non si presentano ("pacchi").
- Sistema di crowdsourcing per lo stato dei campi (es. "canestro rotto", "campo bagnato").
- Containerizzazione con Docker per deployment rapido e consistente.

## Capabilities

### New Capabilities
- `court-mapping`: Estrazione automatica e visualizzazione dei campetti pubblici su mappa interattiva.
- `real-time-checkin`: Check-in GPS-based per confermare la presenza fisica dell'utente sul campo.
- `karma-system`: Sistema di punteggio affidabilità (Karma Score) con penalizzazioni per assenze e ban temporanei.
- `court-status-reports`: Segnalazione crowdsourced dello stato dei campi (condizioni, attrezzature, ecc.).
- `user-auth`: Autenticazione utente semplificata (email/social) per tracciare profili e Karma.
- `match-lobby`: Creazione e gestione di "lobby" di gioco per aggregare giocatori in tempo reale.

### Modified Capabilities
- Nessuna modifica a capability esistenti (progetto da zero).

## Impact

- **Frontend**: Nuovo progetto Next.js con App Router, PWA manifest, service worker.
- **Backend**: Database Supabase con estensione PostGIS per query geografiche.
- **DevOps**: Configurazione Docker e Docker Compose per ambienti di sviluppo e produzione.
- **Dati**: Script Python per scraping dati da OpenStreetMap e popolamento iniziale del database.
- **API**: Integrazione con servizi di geolocalizzazione del browser e Supabase Realtime per aggiornamenti live.
