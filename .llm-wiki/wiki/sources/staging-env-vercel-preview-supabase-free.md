---
type: source
title: "Drop-In: staging = Vercel Preview + progetto Supabase free separato"
slug: staging-env-vercel-preview-supabase-free
status: insight
category: "source"
created: 2026-11-11
updated: 2026-11-11
---

# Drop-In: staging = Vercel Preview + progetto Supabase free separato

# Drop-In: staging = Vercel Preview + progetto Supabase free separato

## Setup effettivo (2026-11-11)
- **stage frontend**: Vercel project `drop-in`, branch Git `stage`, scope env **Preview** (custom environment "staging" è Pro-only). URL stabili: `drop-in-git-stage-andrea-fioris-projects-14d416c7.vercel.app` (alias di branch, auto-aggiornato) + alias custom `drop-in-stage.vercel.app`, che **non** segue il branch: va riassegnato a ogni release (vedi `vercel-alias-custom-non-segue-la-release`).
- **stage backend**: Supabase project `drop-in-staging`, ref `ygnjqqgnxdmgpeeidkbn`, eu-central-1. Free plan = **2 progetti attivi per owner**: prod (`jeuqmmiebzeqtdctmtzj`) + staging li esauriscono.
- Auth staging: Site URL = alias stage, additional_redirect_urls = `https://drop-in-stage.vercel.app/**` + `https://*-andrea-fioris-projects-14d416c7.vercel.app/**` (i preview cambiano hostname a ogni deploy), email confirmations off.
- Seed staging: `scripts/seed_courts.sql` (10.130 courts, tutte approved) — `db push` non semina i dati.

## Gotcha che si pagano care
- **`NEXT_PUBLIC_SUPABASE_URL=/supabase` è solo-dev**: il rewrite sta in `next.config.js` dietro `NODE_ENV !== 'development'`. Su Vercel serve l'URL assoluto `https://<ref>.supabase.co`, altrimenti auth/REST/storage muoiono in silenzio (middleware "fails open" → tutti anonimi).
- `ssoProtection` di default = `all_except_custom_domains`: i preview su `*.vercel.app` sono dietro Vercel Authentication (302 al login). Va messo a `null` via API `PATCH /v9/projects/{id}` per uno stage pubblico (Hobby include solo Vercel Authentication; Shareable Link max 1 per account).
- **Non pushare `supabase/config.toml` del repo su remoto**: contiene `site_url=localhost:3000` e il redirect URI Google locale. Usare `config diff/push --workdir <tmp> --remote=<ref>` con un config.toml **minimo** che dichiara solo le proprietà da cambiare (le non dichiarate restano invariate in CLI 3.x).
- `supabase db push` in CLI 3.x defaulta al **local**; per il remoto serve `--remote`. Drift tipo "Remote migration versions not found": può essere il DB docker locale con migration di branch vecchi, non il remoto.
- Connessioni DB dirette free = IPv6-only, Vercel = IPv4-only → da Vercel solo Supavisor o client JS.
- Free Supabase: pausa dopo ~7 giorni di bassa attività DB (resume solo da Dashboard), niente backup/PITR, branching Pro-only, email built-in 2/ora, 1 GB storage, 10 GB banda, 200 conn realtime.

## Comandi utili (agent mode)
- `supabase db query --remote --read-only "<sql>"` per SELECT, `--yes` per mutation.
- `vercel env add NAME --environment preview --type config --value <v> --yes --force`: con i `NEXT_PUBLIC_*` il valore da stdin viene rifiutato.
- Verifica env senza leggere segreti: `vercel env pull /tmp/x --environment=preview` e grep.
- Verifica che un deploy usi il backend giusto: grep del ref `<ref>.supabase.co` nei chunk `/_next/static/chunks/*`.

## Related
- `docs/staging.md` nel repo (fonte di verità), `docs/database-workflow.md`
