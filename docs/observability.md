# Osservabilità

Stato al 2026-11-16 (Phase 4B, lane observability, #32 / #9 / #88). Tre
decisioni, un endpoint, un logger server e cosa resta fuori di proposito.

## Decisioni

### #32 — Error tracking: **niente Sentry, per ora**

| Criterio | Sentry free | Cosa abbiamo già |
|---|---|---|
| Costo | 5.000 eventi/mese, 1 utente | 0 |
| Bundle | +30–40 KB gz sul client (SDK + integrazioni) | 0 |
| Config | DSN, tunnel/proxy per gli ad-blocker, `beforeSend` per scrub PII, source maps | — |
| Valore | stack trace aggregate, release tracking, issue grouping | `app/error.tsx` + `app/global-error.tsx` catturano e mostrano, `lib/logger.ts` logga con scope, `server.boot`/`health.degraded` strutturati |

Motivo della scelta: gli errori client oggi sono rari e riproducibili dagli
utenti con uno screenshot; il costo (bundle + superficie PII + account
esterno) non è giustificato da un volume che non c'è. **Si riapre** quando
succede una di queste:

- un errore si ripete senza che si riesca a riprodurlo localmente;
- si superano ~500 utenti/settimana o arriva traffico reale su prod;
- arriva un incidente in cui "cosa ha lanciato l'errore" era la domanda.

In quel caso: `@sentry/nextjs` con `sendDefaultPii: false`, `beforeSend` che
usa già `redactFields` (sotto), tunnel `/monitoring` per gli ad-blocker, e
`tracesSampleRate` 0 finché il budget bundle non è misurato.

### #9 — Analytics prodotto: **niente terzo, log first-party**

Nessun Google Analytics/PostHog/Plausible in questa fase: il dato utile adesso
è "l'app risponde ed è usabile", non il funnel. Metriche che contano quando
arriveranno utenti veri (DAU, retention 1/7/30, funnel check-in→lobby) si
ricavano dai log strutturati già emessi più una tabella `events` in Supabase;
quando il volume lo richiede si valuta Plausible (privacy-first, no cookie
banner) e si aggiorna `docs/legal/` (cookie/consent). **Nessun session replay**
finché non c'è una base giuridica e un motivo.

Conseguenza: nessun cookie di analytics, quindi nessun banner cookie oggi
(solo cookie essenziali di auth). Vedi lane legal.

### #88 — Uptime, metriche minime, retention

| Cosa | Implementazione | Dove si vede |
|---|---|---|
| Uptime | `GET /api/health` (200 `ok` / 503 `degraded`) | UptimeRobot/Better Stack free, check ogni 5 min sull'alias stage e prod |
| Latenza DB | `checks[0].latency_ms` (HEAD PostgREST) | payload + log `health.degraded` quando supera il timeout (2,5 s) |
| Release | `commit` (`VERCEL_GIT_COMMIT_SHA`), `version` (`lib/app-info.ts`), `env` | payload |
| Error rate | conteggio dei log `error`/`warn` per `event` nel pannello Vercel | manuale, niente dashboard finché non serve |
| DB size | non esposto via API pubbliche senza Management API/token | `docker`/SQL a mano (`select pg_database_size('postgres')`) o pannello Supabase |
| Retention | Vercel Hobby: log runtime ~1 giorno, non configurabile; Supabase free: log API/DB 1 giorno | sufficiente per il debug del giorno stesso, non per audit |

Retention oltre il giorno = provider esterno (Sentry, Grafana Cloud free) o
export: rimandato con #32/#9.

## `/api/health`

```
GET /api/health           # sempre dinamico, cache-control: no-store
200 {"status":"ok","version":"0.1.0","commit":"…","env":"production",
     "uptime_s":1234,"timestamp":"…",
     "checks":[{"name":"database","status":"ok","latency_ms":30}]}
503 {"status":"degraded", …,"checks":[{"…","status":"degraded","detail":"HTTP 500"}]}
```

- Il check DB è una `GET /rest/v1/courts?select=id&limit=1` con la anon key:
  attraversa PostgREST + RLS, cioè il percorso che usa il browser.
- Timeout 2,5 s (`AbortController`): un health che aspetta 30 s fa fallire
  anche il monitor più paziente.
- `detail` è un testo stabile (`HTTP 500`, `timeout dopo 2500ms`, `rete non
  raggiungibile`), mai il corpo della risposta o il DSN.
- In locale `NEXT_PUBLIC_SUPABASE_URL=/supabase` è un path: la route lo
  risolve contro l'origine della richiesta (su Vercel è già assoluto).
- `uptime_s` è il tempo dall'istanza del modulo: su serverless si azzera a
  ogni cold start, non è un SLA. Va letto come "da quanto gira questa
  istanza", non come availability.

Setup monitor (una volta per ambiente, senza segreti): UptimeRobot free, HTTP
check ogni 5 min su `https://drop-in-stage.vercel.app/api/health`, keyword
`"status":"ok"`, alert email. Su prod idem con l'alias prod.

## Log strutturati

`lib/observability/structured.ts`:

```json
{"ts":"2026-11-16T10:47:13.237Z","level":"info","event":"server.boot",
 "version":"0.1.0","node_env":"development","vercel_env":"local",
 "supabase":"/supabase","log_level":"default"}
```

- Una riga JSON per evento, su `stdout`/`stderr`: è ciò che Vercel
  indicizza. Eventi attuali: `server.boot` (`instrumentation.ts`),
  `health.degraded` (`/api/health`).
- `redactFields()` toglie i campi con `token|secret|password|key|dsn|
  authorization|service_role` (anche annidati) e taglia i valori a 200
  caratteri. `key` è volutamente generico: meglio redigere un campo innocuo
  che stamparne uno con una chiave.
- `OBSERVABILITY_SILENT=1` zittisce l'emissione (test/CLI).
- **Non sostituisce `lib/logger.ts`**: quello resta il logger di browser e
  componenti, con mapping console documentato in `docs/logging.md`. Due
  strumenti, due scopi: console leggibile per chi sviluppa, JSON per chi
  conta gli eventi.

Cosa loggare (regola): un evento per transizione di stato che ci si chiede
dopo un incidente ("il server è partito?", "il DB era giù?"). Non loggare
ogni richiesta: il rumore costa e non serve.

## Cosa NON è stato fatto (e perché)

- **Sentry / OpenTelemetry**: vedi #32, sopra.
- **Metriche DB size nel payload health**: richiede Management API con token
  personale o una RPC dedicata (migrazione → lane security): rimandato, si
  guarda il pannello o SQL quando serve.
- **Dashboard**: con 1 giorno di retention una dashboard è decorativa. Quando
  ci sarà un provider di log, la dashboard nasce da lì.
- **`app/layout.tsx`**: non toccato (owner a11y); il boot log server non
  richiede modifiche al layout. Il boot log client (`BootLog`) resta com'è.

## Verifica

| Cosa | Come | Esito |
|---|---|---|
| Payload ok/degraded | `npx vitest run tests/unit/health.test.ts` | 6 casi: ok, 500, rete, timeout, key in header, degraded con più check |
| Redazione e formato | `npx vitest run tests/unit/structured-log.test.ts` | 5 casi: JSON, campi annidati, troncamento, nessuna mutazione |
| Endpoint reale | `curl localhost:3220/api/health` su dev server | `200 {"status":"ok",…"latency_ms":30}` |
| Boot log reale | stdout del dev server dopo il restart | `{"event":"server.boot",…}` presente |
| Build | `npm run build` | verde (instrumentation inclusa) |
