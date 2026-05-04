# Drop-In: Street Edition

Trova campetti da basket, unisciti a partite, gioca a basket in strada. PWA per organizzare partite amatoriali nei campetti pubblici.

## Cos'è

Drop-In è una Progressive Web App che mostra in tempo reale chi sta giocando, dove e a che ora. Niente gruppi WhatsApp dispersivi, niente campi occupati a sorpresa.

**Funzionalità principali:**
- **Mappa** dei campetti pubblici con dati da OpenStreetMap
- **Lobby** per aggregare giocatori in tempo reale
- **Check-in GPS** per verificare la presenza sul campo
- **Karma Score** per incentivare l'affidabilità
- **Segnalazioni** sullo stato dei campi (canestro rotto, campo bagnato, ecc.)

---

## Come usare

### 1. Installa e avvia

```bash
# Installa dipendenze
npm install

# Avvia in locale
npm run dev
```

L'app è disponibile su `http://localhost:3000`.

### 2. Configura Supabase (backend)

```bash
# Avvia Supabase locale
npx supabase start

# Applica il database (tabelle, indici, trigger)
npx supabase db reset
```

Copia le variabili d'ambiente che Supabase ti mostra in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Carica i campetti

```bash
# Estrai campetti da OpenStreetMap (zona Roma/San Lorenzo)
python scripts/extract_osm.py

# Carica nel database
npx supabase db execute --file scripts/seed_courts.sql
```

### 4. Usa l'app

1. **Naviga** sulla mappa senza registrazione (browse-first)
2. **Accedi** con Email o Google per partecipare
3. **Crea una lobby** selezionando un campo, orario e numero giocatori
4. **Unisciti** a una lobby esistente
5. **Fai check-in** quando sei sul campo (validazione GPS < 50m)
6. **Segnala** problemi sul campo (canestro rotto, illuminazione, ecc.)

---

## Stack

| Livello | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + PostGIS, Auth, Realtime) |
| Mappa | MapLibre GL JS |
| PWA | Serwist (Service Worker, offline cache) |

---

## Script utili

```bash
npm run dev        # Avvia in sviluppo
npm run build      # Build di produzione
npm run lint       # Controllo codice

npx supabase start    # Avvia Supabase locale
npx supabase stop     # Ferma Supabase locale
npx supabase db reset # Reset database + migrazioni

python scripts/extract_osm.py  # Estrai dati OSM
```

---

## Deploy

### Frontend → Vercel

```bash
npm i -g vercel
vercel --prod
```

### Backend → Supabase Cloud

1. Crea progetto su [supabase.com](https://supabase.com)
2. Abilita PostGIS in Database → Extensions
3. Esegui `001_initial_schema.sql` dall'SQL Editor
4. Configura Google OAuth in Authentication → Providers

---

## Docker (opzionale)

```bash
docker-compose up --build
```

---

**Licenza:** MIT
