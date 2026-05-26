# Dev Login Bypass — Context Prompt

Stavamo implementando un developer login bypass per questo progetto (Next.js 15 + Supabase). Ecco lo stato:

## Branch
`feature/developer-login-bypass`

## Obiettivo
Bottone "Dev Login" in basso a sinistra (viola, floating) che fa login automatico come utente dev con karma=999. Solo in dev locale, zero tracce in produzione.

## Cosa è stato fatto

### File creati/modificati:
- `app/api/dev-login/route.ts` — API route GET che fa sign-in + crea utente via Admin API se non esiste, setta cookie di sessione
- `components/dev/dev-button.tsx` — Bottone viola floating, chiama `/api/dev-login`, ricarica pagina
- `app/layout.tsx` — Aggiunto `<DevButton />`
- `lib/supabase/middleware.ts` — Ripristinato all'originale (nessun auto-login)

## Bug attuale (DA FIXARE)
L'API `/api/dev-login` ritorna 404. Il double gate nel route usa `NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")` ma il `.env.local` ha `http://127.0.0.1:54421`. Ho appena fixato aggiungendo anche `includes("127.0.0.1")` ma non ho testato.

## Fix rimanenti
1. Testare che `/api/dev-login` funzioni (non 404)
2. Il file `app/api/favorites/route.ts` usa `process.env.SUPABASE_SERVICE_ROLE_KEY` invece di `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — errore pre-esistente, da fixare a parte

## Come testare
```bash
npm run dev
# Vai su http://localhost:3000
# Clicca "Dev Login" in basso a sinistra
# Dovresti essere loggato come "Dev" con karma=999
```

## Note
- Doppia barriera: NODE_ENV + URL check → zero rischi in produzione
- Tree-shaking verificato: nessuna traccia di codice dev nel bundle di produzione
- `npm run build` fallisce su `/api/favorites` (pre-esistente, non correlato)
- L'utente dev viene creato on-demand via Supabase Admin API (service role key)
- Profilo dev: karma=999, mai bannato → passa tutti i check naturalmente
