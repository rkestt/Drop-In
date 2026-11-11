# Staging — checklist decisionale: self-hosted vs preview temporanea

Questo doc non deploya niente. Serve a misurare il server di casa e decidere
tra self-hosted e preview temporanea Vercel + Supabase cloud free.

## Decisione

- [ ] **Self-hosted** sul server di casa (Sezione 2) — solo se tutti i prerequisiti (Sezione 1) sono verdi.
- [ ] **Preview temporanea** Vercel + Supabase cloud free (Sezione 3) — se manca anche un solo prerequisito.

Riga decisione: _______________________________________________ *(da compilare dopo il report del server)*

## 1. Prerequisiti misurabili del server di casa

| Requisito | Soglia | Comando di misura (Linux) | Esito (da compilare) |
|---|---|---|---|
| RAM | ≥ 8 GB (Supabase self-hosted ~4–6 GB) | `free -g` | |
| Disco libero | ≥ 50 GB | `df -h /` | |
| Upload | ≥ 20 Mbps | `speedtest-cli` oppure `curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py \| python3 -` | |
| IP pubblico statico **oppure** Cloudflare Tunnel | statico o tunnel funzionante | `curl -s ifconfig.me` (confronta dopo riavvio router) | |
| Docker + Docker Compose | installati e avviati | `docker --version && docker compose version && systemctl is-active docker` | |
| Accesso SSH | raggiungibile dall'esterno o via tunnel | `ssh utente@host 'echo ok'` | |

Nota locale: su questa macchina docker **non** è abilitato al boot — serve
`sudo systemctl start docker` dopo ogni riavvio (`docs/plans/post-1.5.md`, "Note tecniche").

## 2. Se i prerequisiti ci sono: architettura target self-hosted

- **Next.js** con `output: 'standalone'` (già configurato in `next.config.js:11`).
  L'artefatto standalone gira in un container Node senza dipendenze di build.
- **Supabase self-hosted** via docker compose ufficiale, sullo stesso server.
- **Reverse proxy Caddy o Traefik** con TLS automatico davanti a Next.js.
- **Cloudflare Tunnel** come alternativa al port forwarding: nessun port forwarding
  sul router, il server esce in outbound verso Cloudflare.

Servizi che devono restare **privati** (mai esposti su internet):

| Servizio | Porta tipica | Nota |
|---|---|---|
| PostgreSQL | 5432 | solo rete docker interna |
| Supabase Auth / REST / Realtime / Storage interni | porte compose interne | pubblico solo via proxy/tunnel |
| Supabase Studio | 54323 in locale (`AGENTS.md`) | mai esposto, solo SSH/tunnel locale |

⚠️ Non verificato in-repo: nomi dei servizi/porte del compose ufficiale e la
configurazione Caddy/Traefik/Tunnel vanno prese dalla documentazione ufficiale
al momento del deploy — qui sopra solo i principi (privato vs pubblico).

Env da impostare in staging (nomi reali da `.env.example`):

| Var | Valore in staging |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL assoluto pubblico del progetto staging (in produzione va assoluto, `.env.example:6`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key dello staging |
| `NEXT_PUBLIC_MAP_PROVIDER` | `openfreemap` (default, `.env.example:10`) |

I segreti per le operazioni DB (`SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`)
si leggono da env e **mai** nel repo (`docs/database-workflow.md`, "Cosa non fare").

## 3. Se mancano: fallback preview temporanea

Vercel preview + Supabase cloud free. Limiti reali (coerenti con
`docs/plans/post-1.5.md`, "Vincoli di sequenza" e `docs/database-workflow.md`):

- **Un solo DB per progetto, nessun branch** — il remoto è trattato come
  produzione (`docs/database-workflow.md:3-6`).
- **Pausa dopo 7 giorni di inattività** — primo deploy e smoke entro quella
  finestra; una staging usata di rado va riattivata a mano dalla dashboard
  (`docs/plans/post-1.5.md:43`, `docs/database-workflow.md:70-71`).
- **Niente PITR** — l'unico rollback è il dump manuale prima di ogni push
  (`docs/database-workflow.md:42,57`).
- **Realtime limitato** — 8 channel aperti dai componenti; verificare i limiti
  con due browser reali, non solo in locale (`docs/plans/post-1.5.md:44`).
- **Secondo progetto free possibile** (max 2 attivi per organizzazione):
  `drop-in-staging` linkato da un worktree dedicato, la produzione riceve push
  solo da `master` (`docs/database-workflow.md:60-68`). Ma il piano dice:
  staging su secondo progetto free **solo al primo utente esterno**
  (`docs/plans/post-1.5.md`, "Cosa NON fare ora").

Sequenza vincolata (`docs/plans/post-1.5.md`, "Vincoli di sequenza"): **B prima di
C** (sicurezza/RLS #54/#57/#59 prima delle env), **C prima di D** (senza env e
Auth URLs la preview non autentica), **dump del remoto prima di ogni `db push`**.

## 4. Auth su URL di staging diversa

Il callback OAuth è in `app/api/auth/callback/route.ts` (scambia `code` via
`exchangeCodeForSession` e redirige su `origin`). Cosa riconfigurare per lo staging:

1. **Site URL** → URL pubblico dello staging (dashboard Supabase → Auth → URL configuration).
2. **Redirect URLs** → aggiungere `https://<staging>/api/auth/callback`
   (stesso path del callback nel codice).
3. In locale i valori sono `site_url = "http://localhost:3000"` e
   `additional_redirect_urls = ["https://localhost:3000"]`
   (`supabase/config.toml:39-40`): vanno **aggiunti**, non sostituiti, gli URL staging.
4. Env Vercel `@next_public_*` (al piano risultano non configurate —
   `docs/plans/post-1.5.md`, "Stato di partenza").

**Niente dati reali di produzione sullo staging**: seed demo e dati OSM di test
(`scripts/extract_osm.py --dry-run` prima, poi bbox Roma), mai dump con utenti
reali. Il dump contiene dati → si tiene fuori dal repo
(`docs/database-workflow.md:57-58`).

## 5. Backup

DB (comando dal workflow ufficiale, `docs/database-workflow.md:38,89`):

```bash
npx supabase db dump --linked -f /mnt/backup/dropin-$(date +%F).sql
```

⚠️ Il workflow scrive su `/tmp/`, ma **`/tmp` è tmpfs e si svuota al riavvio**
(`docs/plans/post-1.5.md`, "Note tecniche"): l'output va su disco persistente,
mai solo in `/tmp`.

- Quando: prima di **ogni** `db push` + notturno via cron sullo staging self-hosted.
- Retention proposta: 7 dump giornalieri + 4 settimanali (proposta operativa, non da repo).
- Mai nel repo (contiene dati).

Foto (bucket reale `court-photos`, creato in
`supabase/migrations/010_court_submissions.sql:103-104`, limite 5 MB,
`jpg/png/webp`):

```bash
# Schema indicativo self-hosted: copia il volume storage su disco persistente
docker run --rm -v supabase_storage:/src:ro -v /DISCO/backup:/dst alpine \
  sh -c 'cp -a /src/. /dst/court-photos-$(date +%F)/'
```

⚠️ Non verificato in-repo: il nome del volume storage dipende dal compose
ufficiale al momento del deploy — verificare con `docker volume ls` e aggiornare
questo blocco.

## 6. Verifica post-setup

Comandi del repo (nomi verificati in `package.json:8,16,20`):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:check   # drift locale ↔ remoto, 0 mancanti
npm run test:rls                                  # assertions RLS su DB locale
npm run build                                     # output standalone verde
```

Smoke manuali: browse, signup/login/logout, submit, offline, mappa, realtime con
due browser (join in uno, update nell'altro entro ~2 s). **Non duplicata qui**:
la lista completa è in `docs/plans/post-1.5.md`, "Checklist pre-release"
(punti 1–10: `test:all` + visual + build, PR merge commit, env + Auth URLs,
migration + `db:check`, ≥1 corte `approved` da script OSM, RLS anon sul remoto,
smoke, realtime, service worker N→N+1, `pg_dump` pre-push).

## 7. Rischi e limiti noti misurati in locale

Tutti da `docs/plans/post-1.5.md`, "Note tecniche per la prossima sessione":

- **Docker non abilitato al boot** → `sudo systemctl start docker` dopo ogni riavvio.
- **`/tmp` è tmpfs** → si svuota al riavvio; dump e artefatti solo su disco persistente.
- **Worktree sullo stesso filesystem del repo** (`/mnt/HDDL/Projects/...`),
  `node_modules` via `cp -al`. Con symlink o su `/tmp`, `next/font/local` non
  applica i font e le baseline visive diventano un **falso verde**.
- **Supabase CLI richiede `--yes`** su `db push` quando gira da agente; senza
  token/password nuovi le operazioni remote non funzionano (ruotati l'11/11).
- **Piano free**: pausa dopo 7 giorni di inattività, niente PITR, un solo DB
  (`docs/plans/post-1.5.md:42-44`, `docs/database-workflow.md`).
