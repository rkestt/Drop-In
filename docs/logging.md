# Log applicativi

I log passano da `lib/logger.ts` (`createLogger(scope)`). Il mapping sui
metodi console è fisso e voluto:

| Livello | Metodo console | Visibile in DevTools di default? |
|---|---|---|
| `debug` | `console.debug` | No — serve il livello **Verbose** |
| `info` | `console.info` | Sì (livello **Info**) |
| `warn` | `console.warn` | Sì |
| `error` | `console.error` | Sì |

Soglia di default: `info` in development, `warn` in production.
Override (in ordine): `NEXT_PUBLIC_LOG_LEVEL`, poi `LOG_LEVEL`
(dettagli env in `.env.example`).

## Vedere i log di debug

- **Chrome/Edge:** DevTools → Console → menu a tendina dei livelli
  (di default su "Info") → spunta **Verbose**.
- **Firefox:** DevTools → Console → menu "Livelli di log" → attiva **Verbose**.
- Oppure alza la soglia dell'app: `NEXT_PUBLIC_LOG_LEVEL=debug` in
  `.env.local` e riavvia il dev server.

## Regole

- Un log utile all'utente va emesso **almeno a `info`**, mai solo a
  `debug` (che di default è nascosto).
- All'avvio l'app emette una riga `[boot]` a `info` con env, host
  Supabase, map provider e livello configurato (`components/platform/boot-log.tsx`).
- Nei log non vanno mai chiavi, credenziali, path o query string degli
  URL: per l'host Supabase usa `supabaseUrlHost()` da `lib/logger.ts`.
