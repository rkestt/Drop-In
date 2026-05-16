# Config produzione
1. Aggiorna Google Cloud Console
Nelle credenziali OAuth, aggiungi questi URI (senza rimuovere i locali):

Origini JavaScript autorizzate:

https://TUO-DOMINIO.com
URI di reindirizzamento autorizzati:

https://TUO-PROGETTO.supabase.co/auth/v1/callback
https://TUO-DOMINIO.com/api/auth/callback
Il primo è l'endpoint auth di Supabase cloud, il secondo è il tuo callback Next.js.

2. Configura Supabase Dashboard (produzione)
Vai su Supabase Dashboard → Il tuo progetto → Authentication → Providers
Attiva Google
Inserisci Client ID e Client Secret dalle credenziali Google Cloud
Salva
3. Variabili ambiente produzione
Nel tuo hosting (Vercel, o dove deployi), imposta:

NEXT_PUBLIC_SUPABASE_URL=https://TUO-PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key-di-produzione
SUPABASE_SERVICE_ROLE_KEY=service-role-key-di-produzione
NEXT_PUBLIC_GOOGLE_CLIENT_ID=stesso-client-id
GOOGLE_CLIENT_SECRET=stesso-secret
NEXT_PUBLIC_APP_URL=https://TUO-DOMINIO.com
Non serve più GOOGLE_CLIENT_SECRET in .env.local lato Next.js — lo legge direttamente Supabase cloud dal dashboard. Ma non fa male averlo se usi altri flow.

4. Deploy
Push del codice
Vercel (o altro) prende le env var
L'app funziona identica, ma con URL produzione