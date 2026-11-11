# Database: workflow senza branching (piano Supabase free)

Il piano free dà **un progetto per database e nessun database branch**. Quindi
non esistono "remoto di sviluppo" e "remoto di produzione" separati: il remoto
è uno solo ed è trattato come produzione. Il branching lo facciamo con **git +
database locale**.

## Ruoli dei due database

| Dove | Cos'è | Chi ci scrive |
|---|---|---|
| Locale (`npx supabase start`, Docker) | ambiente di sviluppo: reset libero, seed demo, test | chiunque, su qualunque branch git |
| Remoto (`jeuqmmiebzeqtdctmtzj`) | produzione, schema reale, dati reali | solo `supabase db push`, solo da `design/1.5`/`master` allineati |

Regola: **una migration si scrive e si prova in locale, si revisiona via PR, e
solo dopo il merge si applica al remoto.** Mai `db push` da un branch di feature.

## Cambiare schema (percorso normale)

```bash
# 1. file di migration nuovo, numerazione progressiva
npx supabase migration new nome_descrittivo

# 2. provare la catena da zero (riproducibilità): il DB locale si ricrea
npx supabase db reset

# 3. test
npm run test:all
npm run test:visual --if-present        # le baseline non devono cambiare se non voluto

# 4. allineamento col remoto: deve dire 0 mancanti
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:check

# 5. cosa applicherebbe, senza scrivere
SUPABASE_DB_PASSWORD=... npx supabase db push --linked --dry-run

# 6. dump di sicurezza (il free non ha PITR: questo è l'unico rollback)
npx supabase db dump --linked -f /tmp/dropin-pre-push.sql

# 7. applicare (richiede conferma: da agente serve --yes)
SUPABASE_DB_PASSWORD=... npx supabase db push --linked --yes

# 8. riverifica
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:check
```

## Perché niente branching non è un problema

- **Lo schema vive nei file.** La verità è `supabase/migrations/`, non il DB:
  un branch git con la sua migration è già "isolato", perché nessuno la applica
  al remoto prima del merge.
- **Il locale è sacrificabile.** `db reset` ricrea tutto: lì si possono provare
  migration distruttive, refactor di policy, cambi di trigger.
- **Il controllo di drift è meccanico.** `npm run db:check` confronta le
  versioni locali con `supabase_migrations.schema_migrations` remoto (via
  Management API, sola lettura). Esce 1 se il remoto è indietro o avanti.
- **Il rollback è un dump.** Prima di ogni push: `supabase db dump`. Senza PITR
  è l'unica rete; si tiene fuori dal repo (contiene dati).

## Se serve un secondo ambiente (opzionale, sempre gratis)

Il piano free consente **2 progetti attivi per organizzazione**. Se in futuro
serve una staging vera:

1. crea `drop-in-staging` (secondo progetto free);
2. `npx supabase link --project-ref <staging>` in un worktree dedicato;
3. stesse migration, stessi test: la staging si resetta e si può rompere;
4. la produzione riceve solo push da `master`.

Attenzione: i progetti free vanno **in pausa dopo 7 giorni di inattività**;
una staging usata di rado va riattivata a mano dalla dashboard.

## Cosa non fare

- Non `db push` da un branch di feature o da una lane di lavoro.
- Non modificare il remoto a mano dal SQL Editor: crea drift che `db:check`
  segnala e che nessuna migration sa riprodurre.
- Non applicare migration senza dump quando toccano dati (`UPDATE`/`DELETE`):
  su free non c'è rollback automatico.
- Non mettere segreti (password DB, access token) nel repo: `db push` li legge
  da `SUPABASE_DB_PASSWORD`, `db:check` da `SUPABASE_ACCESS_TOKEN`.

## Comandi rapidi

```bash
npm run db:check                     # drift locale ↔ remoto (richiede SUPABASE_ACCESS_TOKEN)
npx supabase migration list --linked # tabella local | remote | time
npx supabase db push --linked --dry-run
npx supabase db dump --linked -f /tmp/dropin-$(date +%F).sql
```

Riferimenti: `.wayfinder/MAP.md`, `supabase/migrations/`, `scripts/db-check.mjs`.
