# Staging

Fonte di verità per il loop quotidiano migrazioni: `docs/database-workflow.md`.
Roadmap post-1.5: `docs/plans/post-1.5.md`. Qui solo ambienti, limiti e procedure remote.

## Ambienti

| Ambiente | Frontend | Backend |
|---|---|---|
| local | `npm run dev` (localhost:3000) | Supabase locale Docker (API 54321) |
| stage | Vercel Preview, alias https://drop-in-stage.vercel.app (branch `stage`, scope "Preview") | Supabase `drop-in-staging`, ref `ygnjqqgnxdmgpeeidkbn`, eu-central-1 |
| prod | Vercel Production, https://drop-in-rho.vercel.app (branch `master`, scope "Production") | Supabase `Drop-in`, ref `jeuqmmiebzeqtdctmtzj`, eu-central-1 |

Scope Production intoccato e indipendente dallo stage.

## Vercel

Progetto `drop-in`, org `andrea-fioris-projects-14d416c7`, piano Hobby, framework Next.js, Node 26.x, Production Branch `master`, repo collegato (github rkestt/Drop-In).

- Env Preview `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` puntano al progetto staging (verificato via pull delle env Preview).
- Custom environment "staging" solo Pro: lo stage usa lo scope Preview + alias fisso.
- `ssoProtection` messo a null: i preview sono pubblici (di default la Vercel Authentication richiederebbe login Vercel).

## Supabase staging (provisionato e verificato)

- **22 migrazioni 001→022 applicate** (018–021 pushate il 2026-11-12: schema dump prima del push in `/tmp/opencode/staging-schema-20261112.sql`; `022` verificata il 2026-11-12 con `supabase migration list`), PostGIS in `public`, pg_trgm/pgcrypto/uuid-ossp in `extensions`. Produzione è allineata allo stesso punto (001→022).
- Le migrazioni `023`→`027` (sport NULL, favorites, avatars, pending edit, karma notification) sono **solo in locale**: non ancora pushate su staging né su prod. Push e verifica live sul preview sono il passo di deploy, non parte del lavoro di codice.
- Dati: 10.131 corti su staging, 6.364 con `sport` NULL (stessa proporzione del locale: è la ragione della semantica della `023`).
- pg_cron, 5 job: auto-close-lobbies */15, auto-checkout */15, remove-expired-bans orario, archive-old-reports giornaliero 02:00, notify-lobby-starting-soon */5.
- Bucket `court-photos` pubblico, limite 5 MiB (migrazione 010, policy irrigidite dalla 014).
- Publication `supabase_realtime`: profiles, lobbies, lobby_participants, check_ins, push_notifications.
- RLS attiva su 9 tabelle pubbliche su 10; 10.130 courts da `scripts/seed_courts.sql` (tutti `approved`).
- RPC anonima `nearby_courts` e SELECT anonima su courts verificate funzionanti via REST.

## Auth staging

- Site URL `https://drop-in-stage.vercel.app`; redirect aggiuntivi `https://drop-in-stage.vercel.app/**` e `https://*-andrea-fioris-projects-14d416c7.vercel.app/**`.
- Conferme email disabilitate (solo staging: la signup logga subito).
- Google OAuth NON configurato: per abilitarlo aggiungere `https://ygnjqqgnxdmgpeeidkbn.supabase.co/auth/v1/callback` al client OAuth Google e attivare il provider nel progetto staging.
- `/api/auth/callback` deriva l'origin per-request (`new URL(request.url).origin`): qualunque hostname preview allowlisted funziona.

## Limiti e trappole (stato 2026)

Vercel Hobby: 100 deploy/giorno, 1 build alla volta, cap build 45 min, 100 GB fast data transfer, 1M edge request, 4 CPU-h active CPU; oltre la quota il progetto va in pausa e il ripristino richiede ticket al supporto (non automatico). Cron minimo 1/giorno (non usato: i cron stanno in Supabase). Hobby solo uso non commerciale. Preview dietro Vercel Authentication di default; Shareable Link max 1 per account su Hobby.

Supabase Free: 2 progetti attivi per owner (prod + staging li esauriscono; i pausati non contano), 500 MB DB, 1 GB storage con max 50 MB/file e niente trasformazioni immagini, 10 GB banda totale (5 cached + 5 uncached), 200 connessioni realtime di picco / 2M messaggi al mese, 50k MAU auth, nessun backup automatico (solo `supabase db dump`), niente PITR, branching solo Pro, pausa dopo ~7 giorni di scarsa attività DB con resume solo da Dashboard ("Resume project"), email built-in max 2/ora.

Connessioni DB dirette su Free solo IPv6, le function Vercel sono solo IPv4: da Vercel solo Supavisor (session 5432, mai transaction 6543) o client REST/JS. Questa app usa solo il client JS.

Solo locali: `test:rls` e `npm run types` (docker exec / `gen types --local`). Unico check remote-aware: `scripts/db-check.mjs`, richiede `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`.

Gap realtime (noto, non bug staging): `components/report/reported-courts-indicator.tsx` ascolta `court_reports`, fuori publication: non scatta mai.

Debito accettato: PostGIS in schema `public` (migrazione 001 con `CREATE EXTENSION` non qualificato); il security advisor segnalerà `spatial_ref_sys`. Supabase raccomanda `extensions`.

## Procedure

### 1. Nuova migrazione su staging

Da worktree/checkout dedicato, mai da feature branch a metà modifica:

```bash
npx supabase link --project-ref ygnjqqgnxdmgpeeidkbn
npx supabase db push --remote --dry-run
# backup pg_dump prima del push
npx supabase db push --remote --yes
npx supabase db query --remote --read-only "select version from supabase_migrations.schema_migrations order by version desc limit 1"
```

**Trucco utile (2026-11-12):** le migrazioni si possono provare **sul database
reale** senza applicarle, in una transazione che finisce in `ROLLBACK`:

```bash
{ echo "BEGIN;"; cat supabase/migrations/02[3-9]_*.sql; echo "ROLLBACK;"; } > /tmp/dryrun.sql
npx supabase db query --remote=<ref> --file /tmp/dryrun.sql --yes
# poi: select max(version) from supabase_migrations.schema_migrations  -> invariato
```

Con `023`→`029` ha confermato che girano sul dataset reale (10.131 corti) e che
dopo il rollback lo schema è identico. Non sostituisce il backup: non copre i
dati e non dice nulla su cosa succede se il push si interrompe a metà.

**Blocco noto (2026-11-12):** il backup pre-push non si riesce a produrre da questa
macchina — `supabase db dump` (CLI 3.1.0 e `@latest`) usa `pg_dump` 15.19 contro
un server 17.11 e aborta con *"server version mismatch"* (anche `pg_dump`
locale è 15). Il dry-run invece funziona e non richiede password. Per il push
servono o il client PostgreSQL 17 installato, o `docker run postgres:17
pg_dump` con la password del database. Senza backup il push **non** va fatto
(niente PITR sul piano Free).

`--read-only` obbligatorio per i SELECT in agent mode; le mutation vogliono `--yes`.

### 2. Promozione stage → prod

Merge su `master` solo dopo smoke test verde sullo stage; push migrazioni su prod nella stessa finestra; dump di prod prima del push (niente PITR su Free). Mai push da feature branch.

### 3. Modifiche auth/config sul progetto staging

```bash
npx supabase config diff --workdir <tmp>/supabase --remote=ygnjqqgnxdmgpeeidkbn
# poi config push con config.toml minimo che dichiara SOLO le proprietà
# modificate (le non dichiarate restano invariate)
```

Mai pushare il `supabase/config.toml` del repo così com'è: contiene localhost:3000 e il redirect URI Google locale.

### 4. Rotazione chiavi

Dashboard Supabase → Project Settings → API (oppure `npx supabase projects api-keys --remote=<ref>`) → aggiorna la env Vercel dello scope giusto (`vercel env add NAME --environment preview|production --type config --value <v> --yes --force`) → redeploy → verifica che il login via `/api/auth/callback` funzioni ancora. `NEXT_PUBLIC_*` pubblici per definizione; la service role key mai in `NEXT_PUBLIC_*` (questa app non ha admin client: su Vercel non serve).

### 5. Keep-alive anti-pausa

Attivo: workflow giornaliero `.github/workflows/stage-keepalive.yml` (vedi
"Tenere lo stage in linea e attivo"). La vecchia nota resta valida come
contesto: una banale richiesta giornaliera al DB tiene attivo il progetto
free secondo la doc Supabase. Se il traffico keep-alive automatizzato violi
i ToS non è documentato: pratica tollerata ma non garantita; in alternativa
accettare il rischio pausa.

### 6. Deploy dello stage

Funziona via Git: ogni push su `stage` (e ogni PR) genera un deploy preview con lo scope "Preview". Il branch ha due URL, entrambi vivi:

| URL | Comportamento |
|---|---|
| `drop-in-git-stage-andrea-fioris-projects-14d416c7.vercel.app` | alias per-branch di Vercel: si aggiorna da solo a ogni push |
| `drop-in-stage.vercel.app` | alias leggibile, incatenato al precedente |

Se una build Git non parte (visto una volta subito dopo il collegamento del repo), fallback manuale (di norma basta `npm run stage:alias`, vedi "Tenere lo stage in linea e attivo"):

```bash
npx vercel deploy --yes   # preview
npx vercel alias set <deployment-url> drop-in-stage.vercel.app
```

Per rilanciare la build del branch senza modifiche: `git commit --allow-empty -m "chore: rebuild stage" && git push origin HEAD:stage`.

### 7. Pulizia oggetti orfani

Il bucket pubblico `court-photos` accumula orfani: upload riuscito + `submit_court`
fallita, oppure court cancellata (FK a NULL). Le submission scartate
(duplicata/rifiutata) non creano orfani: `reject_court`/`mark_duplicate`
cambiano solo `moderation_status`, la riga resta referenziata.
Script dedicato, solo manuale, mai in cron/CI (piano free, niente traffico
schedulato da mantenere):

```bash
# Dry-run contro staging (default: non cancella nulla)
SUPABASE_URL=https://ygnjqqgnxdmgpeeidkbn.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run photos:gc

# Cancellazione reale degli orfani idonei
SUPABASE_URL=https://ygnjqqgnxdmgpeeidkbn.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run photos:gc -- --apply
```

- Finestra di sicurezza `--min-age-hours=24` (default 24 h): gli oggetti più
  giovani non si toccano mai, perché potrebbero essere upload di una submission
  ancora aperta nel browser. Abbassarla solo se si è certi che non c'è traffico
  in corso.
- Va eseguito solo dove c'è traffico reale (staging/prod): in locale gli
  "orfani" sono quasi sempre upload di una sessione di dev ancora aperta.
- La service role key resta in env locale, mai committata e mai in `NEXT_PUBLIC_*`.

## Tenere lo stage in linea e attivo

La produzione è ferma per scelta: **lo stage è l'ambiente di riferimento**.
Due cose lo tengono tale — entrambe vanno mantenute, altrimenti lo stage
degrada in silenzio.

### Alias dopo ogni release: `npm run stage:alias`

L'alias leggibile `drop-in-stage.vercel.app` **non** segue le release da
solo; solo l'alias per-branch
`drop-in-git-stage-andrea-fioris-projects-14d416c7.vercel.app` si aggiorna a
ogni push. Senza riassegnazione, l'alias resta indietro: è già successo
(build di 19 h servito come se fosse nuovo).

Dopo ogni release sullo stage:

```bash
npm run stage:alias
```

Lo script prende il deployment più recente del progetto `drop-in`,
verifica via `vercel inspect` che sia davvero del branch `stage` e solo
allora riassegna l'alias, stampando commit/branch di cosa c'è sopra. Se la
conferma del branch non riesce, **non riassegna nulla** ed esce con errore.
Usa l'auth locale del CLI Vercel (`npx vercel login` se manca).

### Keep-alive anti-pausa

Il workflow `.github/workflows/stage-keepalive.yml` (cron giornaliero
`17 7 * * *` + avvio manuale) fa una SELECT anonima su `courts` via REST:
un po' di attività DB al giorno rimanda la pausa automatica dei progetti
free (~7 giorni di inattività).

- Richiede il secret `STAGE_SUPABASE_ANON_KEY`: la publishable key del
  progetto staging (Dashboard Supabase → Settings → API). **Senza quel
  secret il job fallisce** — non silenziosamente: è voluto, così te ne
  accorgi.
- Allo stesso modo, se il progetto è già in pausa il job fallisce
  (REST non risponde 200/206): te ne accorgi dal badge.

### Riconoscere un progetto in pausa

- Le chiamate REST rispondono con errore invece di 200/206 (è così che il
  keep-alive lo segnala).
- La Dashboard Supabase mostra il progetto come sospeso con un pulsante
  "Resume project": il resume è solo manuale, dalla Dashboard.

## Decisioni

- Progetto Supabase free separato invece di database branching (branching solo Pro e fatturato a ore).
- Stage sullo scope Vercel Preview con alias fisso (custom environment solo Pro).
- Nessuna service-role key da nessuna parte.

## Fonti (recuperate 2026-11-11)

- https://vercel.com/docs/limits
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/git
- https://vercel.com/docs/deployment-protection/usage-and-pricing
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/deployments/generated-urls
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/deployment
- https://supabase.com/docs/guides/local-development/cli-workflows
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/storage/buckets/creating-buckets
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/rate-limits
