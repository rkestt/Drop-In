# CI, deploy e backup

Stato al 2026-11-16 (Phase 4B, lane CI, #85). Cosa gira su GitHub Actions,
come si promuove un rilascio, come si torna indietro, e quale backup esiste
davvero (spoiler: su piano free il nostro `pg_dump` è l'unico).

## Pipeline (`.github/workflows/`)

| Workflow | Trigger | Cosa fa | Bloccante |
|---|---|---|---|
| `ci.yml` → `quality` | push master, PR | `npm ci`, lint, `lint:design`, `tsc`, unit, build, axe statico, visual static | sì |
| `ci.yml` → `rls` | idem | Supabase locale (`supabase start` + `db reset`) e `npm run test:rls`: 46 blocchi SQL su RLS/trigger/grant/rate limit | sì |
| `ci.yml` → `e2e` | idem | Supabase locale + Playwright completa con `E2E_WITH_DB=1` (62 test, inclusi i flussi autenticati) | sì |
| `backup.yml` | lunedì 02:23 UTC, manuale | `pg_dump` custom format di staging, artifact 90 giorni | no (ma fallisce visibilmente) |
| `stage-smoke.yml` | push su `stage`, manuale | aspetta che il **branch alias** serva il commit del push, poi smoke su branch alias e su `drop-in-stage.vercel.app` con `--expect-commit`; fallisce se l'alias pubblico è rimasto al build vecchio | sì sul branch stage |
| `stage-keepalive.yml` | giornaliero | una SELECT anonima per non far pausare il progetto free | no |

`quality` gira senza Supabase: le pagine che costruiscono il client a build
time ricevono URL e anon key finti (nessuna chiamata di rete nel prerender).
`rls` ed `e2e` avviano un Supabase locale vero: niente project ref, niente
secret, chiavi demo già note.

Costo/tempi: il primo step dei job con Supabase scarica le immagini Docker
(2–4 min su runner GitHub, nessuna cache fra run); il resto è ~2–3 min.
Timeout 25/30 minuti. Se `e2e` diventa flaky su rete esterna (tile), il primo
sospetto sono i test mappa, non l'app: si isolano con `--grep-invert`.

## Equivalenti locali

```bash
npm run test:all        # tutto quello che fanno i tre job (rls incluso, con Supabase locale)
npm run test:rls        # solo RLS/trigger/grant
E2E_WITH_DB=1 npx playwright test --project=e2e
npm run smoke -- https://drop-in-stage.vercel.app
```

`test:all` richiede Docker attivo e `npx supabase start` già eseguito.

## Alias stage: un passo manuale (finché non c'è `VERCEL_TOKEN`)

Vercel aggiorna da solo l'alias per-branch
(`drop-in-git-stage-andrea-fioris-projects-14d416c7.vercel.app`), **non** il
dominio leggibile `drop-in-stage.vercel.app`. Dopo ogni push su `stage`:

```bash
npm run stage:alias   # richiede la CLI Vercel autenticata in locale
node scripts/smoke.mjs https://drop-in-stage.vercel.app --with-health --expect-commit "$(git rev-parse HEAD)"
```

`stage-smoke.yml` è costruito per accorgersene: aspetta il commit sul branch
alias e poi verifica lo stesso commit sull'alias pubblico; se è rimasto al
build precedente il job diventa rosso con il messaggio "esegui
`npm run stage:alias`". È successo davvero: un 200 sull'alias vecchio veniva
scambiato per deploy nuovo. Per automatizzare la riassegnazione serve il
secret `VERCEL_TOKEN` e un passo `vercel alias set` nel workflow.

## Modello branch → deploy

| Branch | Vercel | Supabase | Note |
|---|---|---|---|
| `master` / `develop` | nessun deploy prod | — | sviluppo |
| `stage` | Preview + alias `drop-in-stage.vercel.app` | `drop-in-staging` (`ygnjqqgnxdmgpeeidkbn`) | ogni push ri-deploya il branch alias; **l'alias pubblico no** (vedi sotto) |
| `production` | **Production** (Production Branch) | `Drop-in` (`jeuqmmiebzeqtdctmtzj`) | prod congelata a `022` finché non si fa la promotion |

Dettagli ambiente e variabili: `docs/staging.md`. Il `site_url`/redirect di
Auth per staging sono già impostati; per prod valgono le stesse regole con
l'alias `drop-in-rho.vercel.app`.

## Promotion `develop` → `production`

Prerequisiti: backup fresco di prod, migrazioni applicate a staging e
verificate, `test:all` verde su `develop`.

1. **Backup prod** (l'unica rete di sicurezza su piano free):
   ```bash
   ./scripts/backup-db.sh --dsn "$PROD_DB_URL" --label prod --i-know-this-is-prod
   ```
   Conservare il file **fuori** dalla macchina (vedi sotto).
2. **Migrazioni**: allineare staging (`npx supabase db push --remote` dal
   branch giusto) e verificare lo schema con `supabase db diff --remote`.
   Mai pushare `supabase/config.toml` del repo su remoto: contiene
   `site_url` localhost e il redirect Google locale.
3. **Config Auth**: SOLO pannello (SMTP, redirect, template) — vedi
   `docs/email.md`. Niente secret nel repo.
4. **Merge** `develop` → `production` e push: Vercel deploya Production.
5. **Smoke**:
   ```bash
   node scripts/smoke.mjs https://drop-in-rho.vercel.app --with-health
   ```
   Più un giro manuale: mappa, login, check-in, lobby (la mappa dipende da
   tile esterni: il primo sospetto su un 500 è il provider).
6. **Allineare `stage`** a master dopo il rilascio:
   `git push --force-with-lease=refs/heads/stage:<old> origin +origin/master:refs/heads/stage`.

Le migrazioni sono **forward-only**: non si scrivono `down` script. Un errore
di schema si corregge con una migrazione nuova; un danno ai dati si recupera
da dump/PITR (sotto).

## Rollback

| Cosa | Come | Tempo |
|---|---|---|
| Codice | Vercel → Deployments → Promote/Rollback al deploy precedente (istantaneo, niente rebuild) | secondi |
| `stage` rotto | push del commit buono sul branch `stage` | 1–2 min |
| Migrazione sbagliata | nuova migrazione correttiva (forward-only); se ha già scritto dati, restore mirato della tabella dal dump | minuti/ore |
| Dati distrutti | `scripts/restore-db.sh` su un DB di ripristino, poi copia mirata (mai restore diretto su prod: il piano free non ha PITR, quindi il dump è l'unico punto nel tempo) | dipende dal volume |

Il piano free Supabase **non** ha backup automatici né PITR: la sezione
backup sotto non è opzionale.

## Backup

`scripts/backup-db.sh`:

```bash
# staging (default: tag staging, 14 dump conservati)
./scripts/backup-db.sh --dsn "$STAGE_DB_URL" --label staging --out ~/backups/dropin

# produzione: richiede --i-know-this-is-prod (guardia sul ref noto)
./scripts/backup-db.sh --dsn "$PROD_DB_URL" --label prod --i-know-this-is-prod

# retention e cartella
./scripts/backup-db.sh --dsn ... --out /mnt/navi/backup/dropin --keep 30
```

- Formato custom `pg_dump` (`-Fc`), `--no-owner --no-privileges`: il restore
  funziona anche su un progetto con owner diversi.
- pg_dump 17: usa il binario locale se ≥ 17, altrimenti `docker run postgres:17`
  con `--network host`. Un client 17 legge i server 15 di prod/staging.
- Scrive `<label>-<UTC>.dump` + `.sha256`. Il DSN non viene mai stampato.
- Retention per label (`--keep`, default 14).
- **Dove conservarli**: non nel repo (`backups/` è in `.gitignore`) e non solo
  sul portatile. Destinazione: NAS `/mnt/navi/external_usb` e/o storage
  cifrato (i dump contengono email e hash: vanno trattati come dati personali,
  vedi `docs/legal/`). Il workflow GitHub conserva 90 giorni come artifact:
  è un ponte, non un archivio.

`scripts/restore-db.sh` rifiuta host non locali senza `--allow-remote`, rifiuta
il DSN di prod per costruzione, richiede `--yes` e verifica il checksum.

### Restore drill (eseguito)

```bash
# 1. dump
./scripts/backup-db.sh --dsn postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --label local --out /tmp/opencode/backups
# -> 1,1 MB in 1 s

# 2. database di prova vuoto
docker exec supabase_db_drop-in psql -U postgres -d postgres \
  -c "CREATE DATABASE restore_drill"

# 3. restore
./scripts/restore-db.sh --file /tmp/opencode/backups/local-<stamp>.dump \
  --dsn postgresql://postgres:postgres@127.0.0.1:54322/restore_drill --yes

# 4. verifica
docker exec supabase_db_drop-in psql -U postgres -d restore_drill \
  -c "select (select count(*) from public.courts) courts,
             (select count(*) from supabase_migrations.schema_migrations) migrations"
```

Risultato del drill del 2026-11-16: `courts = 10130`, `migrations = 35`,
`auth.users = 1`. `pg_restore` riporta 83 warning ignorati: sono oggetti di
estensione (`cron`, `graphql`, `storage`, `vault`) che in un database vuoto non
esistono — i dati applicativi sono completi. Il drill va rifatto quando
cambiano le estensioni o si passa a un piano con PITR.

Cadenza consigliata: staging settimanale (workflow), prod **prima di ogni
promotion** e mensile a mano.

## Secret (solo nomi, mai valori)

| Nome | Dove | Serve a |
|---|---|---|
| `STAGE_DB_URL` | GitHub secrets | workflow backup / restore manuale staging |
| `STAGE_SUPABASE_ANON_KEY` | GitHub secrets | keep-alive staging |
| `SUPABASE_DB_URL` (locale, `.env`) | macchina dev | script backup/restore |
| credenziali SMTP | pannello Supabase (Auth → SMTP) | email, vedi `docs/email.md` |
| `VERCEL_TOKEN` | opzionale, secrets | `scripts/stage-alias.mjs` da CI |

Nessuna chiave service-role in CI: i test usano quelle demo del Supabase
locale, che valgono solo contro `127.0.0.1`.

## Verifica di questa lane

| Cosa | Come | Esito |
|---|---|---|
| Sintassi script | `bash -n scripts/backup-db.sh scripts/restore-db.sh` | ok |
| Backup reale | dump del DB locale | 1,1 MB, checksum scritto |
| Restore reale | restore in `restore_drill` | 10.130 courts, 35 migrazioni |
| Smoke | `node scripts/smoke.mjs http://127.0.0.1:3210` su dev server | `/` e manifest 200, health 404 gestito |
| YAML workflow | parse con `yaml.safe_load` | 3 workflow validi |

Non verificato qui: esecuzione dei job su GitHub (serve un push, che il
coordinatore fa al merge). I comandi che i job lanciano sono gli stessi
eseguiti in locale in questa lane.
