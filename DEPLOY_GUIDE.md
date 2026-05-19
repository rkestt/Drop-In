# Guida Deploy - Drop-In PWA

Questa guida spiega come mettere in produzione l'app Drop-In con database e PWA funzionanti.

---

## Prerequisiti

- Account GitHub
- Account Supabase (supabase.com)
- Account Vercel (vercel.com)

---

## Step 1: Supabase Cloud Setup

### 1.1 Creare progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e accedi
2. Clicca **New project**
3. Compila:
   - **Name**: `drop-in-prod`
   - **Database Password**: scegli una password robusta (salvala!)
   - **Region**: `EU (Frankfurt)` o la più vicina a te
4. Clicca **Create new project**
5. Aspetta 2-3 minuti per la creazione

### 1.2 Ottenere credenziali

1. Nella dashboard del progetto, vai su **Project Settings** (⚙️) → **API**
2. Copia:
   - **Project URL** → sarà qualcosa come `https://xxxxx.supabase.co`
   - **anon public** key → chiave anonima

### 1.3 Popolare il database

```bash
# Prima, rimuovi la configurazione locale
rm -f .env.local

# Crea il file .env con le credenziali cloud
echo "NEXT_PUBLIC_SUPABASE_URL=https://TUO_PROGETTO.supabase.co" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=TUA_CHIAVE_ANON" >> .env.local

# Esegui le migrations sul database cloud
npx supabase db push
```

Se hai problemi, usa la stringa di connessione dalla dashboard Supabase → **Settings** → **Database** → **Connection string**.

---

## Step 2: Configurare Vercel

### 2.1 Collegare il repository

1. Vai su [vercel.com](https://vercel.com) e accedi con GitHub
2. Clicca **Add New** → **Project**
3. Trova il repository `Drop-In`
4. Clicca **Import**

### 2.2 Configurare Environment Variables

Nella schermata di import:

1. Scorri giù fino a **Environment Variables**
2. Aggiungi:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TUO_PROGETTO.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La chiave anon che hai copiato |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | (Opzionale) La chiave service role dalla dashboard Supabase → API |

3. Clicca **Deploy**

### 2.3 Attendere il deploy

- Tempo stimato: 3-5 minuti
- Se il deploy fallisce, controlla i log nella dashboard Vercel

---

## Step 3: PWA - Icone iOS

### 3.1 Aggiungere apple-touch-icon

Modifica `app/layout.tsx` per aggiungere i meta tags per iOS:

```tsx
export const metadata: Metadata = {
  title: "Drop in — Street Edition",
  description: "Trova campetti, unisciti a partite, gioca a basket in strada.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Drop in",
  },
  icons: {
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};
```

### 3.2 Verificare che le icone siano accessibili

Assicurati che `public/icons/icon-192.png` e `icon-512.png` esistano e siano state incluse nel deploy.

---

## Step 4: Verificare la PWA

### 4.1 Chrome (Android/Desktop)

1. Apri il sito su Chrome (es. `https://drop-in.vercel.app`)
2. Apri DevTools (`F12`) → **Application** tab
3. Verifica:
   - **Manifest**: Mostra icone, screenshot, name, short_name
   - **Service Workers**: Status "Activated and running"
4. Prova installazione: dovrebbe apparire il prompt "Install Drop-In"

### 4.2 Safari (iOS)

1. Apri il sito su iPhone/iPad
2. Tocca **Condividi** → **Aggiungi alla Home Screen**
3. Verifica che l'icona appaia e che l'app si apra senza la barra dell'URL

### 4.3 Test Lighthouse

1. Chrome DevTools → **Lighthouse** tab
2. Clicca **Analyze page load**
3. Verifica che la sezione **PWA** abbia tutti check verde

---

## Troubleshooting

### "No manifest detected"

- Verifica che `manifest.json` sia in `public/`
- Controlla che il file sia accessibile: `https://tuosito.com/manifest.json`
- Riprova con hard refresh (`Ctrl+Shift+R`)

### "PWA not installable"

- Verifica che ci siano almeno 2 icone (192 e 512px)
- Verifica che ci sia almeno 1 screenshot
- Controlla che il manifest abbia `display: standalone`

### Errori database

- Verifica le environment variables su Vercel
- Controlla che il database Supabase sia raggiungibile
- Testa locally con `npm run dev` e le stesse env

---

## Comandi utili

```bash
# Build locale
npm run build

# Dev locale con Supabase
npx supabase start  # Avvia Docker Supabase
npm run dev

# Push database (se hai config supabase)
npx supabase db push
```

---

## Costo stimato

| Servizio | Piano | Costo |
|----------|-------|-------|
| Supabase | Free | €0 |
| Vercel | Hobby | €0 |
| **Totale** | | **€0/mese** |

Il piano gratuito è sufficiente per un MVP con fino a qualche migliaia di utenti.

---

*Guida aggiornata: 2026-05-19*
*Progetto: Drop-In Web App*