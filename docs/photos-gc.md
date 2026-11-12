# Photo GC (`npm run photos:gc`)

Pulizia degli oggetti orfani nei bucket `court-photos` e `avatars`
(script `scripts/cleanup-orphan-photos.mjs`, zero dipendenze).

## Cosa sono gli orfani

Oggetti storage senza più alcun riferimento nel DB:

- `court-photos`: upload riuscito + `submit_court` fallita, oppure corte
  cancellata (FK a NULL). Le submission scartate (duplicata/rifiutata) NON
  sono orfani: `reject_court`/`mark_duplicate` toccano solo
  `moderation_status`, la riga resta referenziata.
- `avatars`: avatar sostituito o rimosso senza cancellare il vecchio oggetto
  (il drawer cancella best-effort alla sostituzione, ma un upload seguito da
  chiusura senza salvataggio lascia comunque un orfano).

Referenze tracciate: `courts.photo_path` (bare path) e `profiles.avatar_url`
(URL pubblico assoluto o bare path — conta la parte dopo
`/storage/v1/object/public/avatars/`; i valori estranei al bucket vengono
ignorati, mai cancellati).

## Uso

```bash
# Sempre dry-run prima: elenca e basta.
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/cleanup-orphan-photos.mjs

# Solo --apply cancella davvero.
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/cleanup-orphan-photos.mjs --apply [--min-age-hours=24]
```

Env: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role, mai
committarla). Exit code: 0 ok, 1 almeno una cancellazione fallita, 2 errore
di configurazione/rete/flag.

## Finestra di sicurezza (24h)

Gli oggetti più giovani di `--min-age-hours` (default 24) non si toccano mai:
copre l'upload in corso mentre la submission è ancora aperta nel browser, o
l'avatar appena caricato prima del write su `profiles`. Gli oggetti senza
data non si toccano mai. Mai contro il locale: lì gli "orfani" sono quasi
sempre upload di una sessione di dev ancora aperta.

## Perché non è un pg_cron job

pg_cron gira dentro Postgres e non può chiamare la Storage API (serve la
service role key su HTTP) — vedi issue #52. Cadenza: manuale `--apply`
mensile finché non c'è traffico reale, poi uno scheduler esterno (GitHub
Action o Vercel Cron) con gli stessi secret.
