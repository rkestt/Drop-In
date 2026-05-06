# Drop-In — Learning Log

Note di Dennis. Spiegazioni, concetti, scoperte.

---

## Supabase: perché l'app non funziona senza di esso

**Problema:** L'app mostra `ERR_CONNECTION_REFUSED` verso `http://127.0.0.1:54321`.

**Cause:** Supabase locale non è avviato.

**Architettura:**

```
Browser (Next.js)                    Supabase (locale)
─────────────────                    ──────────────────
   │                                       │
   │  "Dammi i courts"                     │
   │ ─────────────────────────────────────►│
   │                                       │
   │            ERR_CONNECTION_REFUSED     │
   │ ◄─────────────────────────────────────│
   │  (nessuno risponde sulla porta 54321) │
```

Drop-In è un **frontend** che ha bisogno di un **backend**:

| Componente | Ruolo |
|---|---|
| Next.js (Drop-In) | Mostrare la mappa, i bottoni, le pagine — da solo non sa nulla |
| Supabase | È il "cervello": database (courts, lobbies, utenti), auth, aggiornamenti in tempo reale |

**Soluzione:**
```powershell
npx supabase start
```

Porta su API (54321), DB (54322), Studio (54323).

---

## Supabase Realtime: come funziona il WebSocket

**Cos'è:** Una connessione sempre aperta tra browser e server. Il server "spinge" dati al browser senza che il browser debba chiedere.

**L'analogia del ristorante:**
- **Polling:** Vai al bancone ogni 5 secondi: "Ci sono novità? E ora? E adesso?"
- **WebSocket:** Dici al cameriere "Siediti, ti chiamo io." E ti ignori finché non arriva lui.

Drop-In apre una "linea telefonica sempre accesa" verso Supabase e dice "fammi sapere quando cambiano i campi o le partite." Supabase risponde solo quando succede qualcosa, senza che il browser debba chiedere.

**Flusso passo passo:**

```
1. Browser carica Drop-In
   └─► React crea un client Supabase
        └─► Il client apre una connessione WebSocket a Supabase
             ws://127.0.0.1:54321/realtime/v1/websocket?apikey=...
             ▲ Questa connessione resta APERTA

2. Il client si "iscrive" ai canali che gli interessano
   └─► Canale "courts"    → "avvisami quando cambiano i courts"
   └─► Canale "lobbies"   → "avvisami quando cambiano i lobbies"
   └─► Canale "presenze"  → "avvisami quando qualcuno entra/esce"

3. Un utente fa qualcosa (es. crea una lobby)
   └─► Browser → REST API: INSERT INTO lobbies (...)
   └─► Supabase valida, salva nel DB PostgreSQL
        └─► PostgreSQL NOTIFICA Supabase Realtime
             └─► Supabase manda un messaggio WebSocket a tutti i client iscritti
                  └─► Il tuo browser riceve l'aggiornamento
                       └─► React aggiorna la UI senza ricaricare
```

**I tre layer:**

| Layer | Chi sono | Cosa fanno |
|---|---|---|
| **PostgreSQL** | Il database | Riceve INSERT/UPDATE/DELETE |
| **pg_notify** | Sistema di eventi di Postgres | Dice a Supabase "è cambiato qualcosa" |
| **Supabase Realtime** | Il server WebSocket | Inoltra il messaggio a tutti i client connessi |

**Due protocolli distinti:**
- **REST API** (`GET /rest/v1/courts`) — richieste normali, tipo "dimmi i dati"
- **WebSocket** (`ws://.../websocket`) — connessione persistente, tipo "avvisami quando cambiano le cose"

Entrambi falliscono con `ERR_CONNECTION_REFUSED` quando Supabase è spento.

---

## Frontend e Backend: la distinzione fondamentale

**Frontend** = quello che vedi. Il sito, l'app, la schermata.

**Backend** = quello che non vedi. Il cervello che processa i dati, le regole, la logica.

Drop-In è frontend. Supabase è backend. Sono due programmi separati che comunicano tra loro.

---

## Arricchire i dati dei campi: reverse geocoding

**Il problema:** OSM (OpenStreetMap) ha le coordinate GPS di 282 campi basket a Roma — sa dove sono. Ma non ha il nome della strada, né il numero civico, né il tipo di pavimento. Risultato: sulla mappa vedi pallini senza contesto, "Indirizzo non disponibile".

**La soluzione:** il reverse geocoding — da coordinate GPS a indirizzo leggibile.

```
Coordinate GPS (lat/lng)     →     Indirizzo
───────────────────────────────────────────
41.8694, 12.5211           →     Via della Balduina, Roma
41.8128, 12.4856           →     Via Trionfale, Roma
```

**Come funziona:** lo script `enrich_courts.py` prende ogni campo basket, lo manda a **Nominatim** (il geocoder gratuito di OSM), che legge le coordinate e risponde con l'indirizzo stradale. Rate limit: 1 richiesta al secondo.

**Perché OSM non ha gli indirizzi:** OSM mappa le cose per come le vede fisicamente. Un campo basket in un parco ha `sport=basketball`, ma raramente `addr:street`. Il geocoder inverso ricostruisce l'indirizzo usando la mappa stradale sottostante.

**Tre strade per arricchire i dati:**

| Strada | Come | Limitazione |
|---|---|---|
| Reverse geocoding (quello nostro) | Da coordinate → indirizzo | Non aggiunge nome vero né canestri |
| Query OSM più smart | Prendere più tag da OSM | Dipende da quanto è stato mappato |
| Google Maps API | Geocoding preciso | Costa |

