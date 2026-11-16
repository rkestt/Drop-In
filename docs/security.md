# Sicurezza e anti-abuso

Stato al 2026-11-16 (Phase 4B, lane security, #84). Cosa è implementato, dove,
e cosa richiede una decisione o un piano a pagamento.

## Modello di minaccia

| Attore | Può | Difesa |
|---|---|---|
| Anonimo | leggere campi approvati, lobby, check-in, recensioni; nessuna scrittura | RLS + grant minimi (`035`), nessuna policy INSERT per `anon` |
| Utente autenticato | proporre campi, segnalare, check-in, lobby, recensioni, preferiti | RLS own-rows + rate limit per azione (`034`) + moderazione |
| Utente malevolo | chiamare PostgREST direttamente con il proprio JWT | rate limit nel database (non nel middleware: aggirabile) |
| Moderatore | approvare/rifiutare/duplicare, vedere proposte altrui | RPC `SECURITY DEFINER` con gate `is_moderator` |
| Bot / script | registrarsi e scrivere | quota email (vedi `docs/email.md`), rate limit, moderazione a monte |

Il client parla **direttamente** con Supabase (`supabase.from(...).insert()`):
qualsiasi limite applicativo in Next.js è aggirabile con una chiamata REST e lo
stesso JWT. Per questo i limiti stanno in trigger `BEFORE INSERT` nel database.

## Rate limit (#84, migrazione `034`)

Tabella `public.rate_limit_events` (bucket, subject, created_at), RLS attiva
senza policy e nessun grant ai client: si legge solo dalle funzioni
`SECURITY DEFINER`.

| Bucket | Limite | Tabella | Messaggio (P0001) |
|---|---|---|---|
| `report` | 5 / ora | `court_reports` | "Hai inviato troppe segnalazioni nell'ultima ora…" |
| `lobby` | 5 / ora | `lobbies` | "Hai creato troppe lobby nell'ultima ora…" |
| `lobby_join` | 30 / ora | `lobby_participants` | "Troppi ingressi nelle lobby nell'ultima ora…" |
| `review` | 10 / ora | `court_reviews` | "Hai scritto troppe recensioni nell'ultima ora…" |
| `check_in` | 20 / ora | `check_ins` | "Troppi check-in nell'ultima ora…" |
| `submit_court` | 1 / ora | RPC `submit_court` | già in `031` (lock advisory + conteggio) |

Dettagli:

- La finestra è **fissa e scorrevole sui dati**: si contano gli eventi degli
  ultimi N minuti, non un contatore che si azzera a orologio.
- `pg_advisory_xact_lock(hashtext('rate_limit:<bucket>:<uid>'))` serializza
  check-then-insert: due richieste concorrenti non passano entrambe.
- Sessioni senza claim (`psql`, cron, `service_role`) **non** vengono limitate:
  i trigger escono subito con `auth.uid() IS NULL`. Seed, migration e test
  restano scrivibili.
- Lo sforamento è `P0001` con testo italiano: la UI lo mostra così com'è
  (stesso percorso degli altri errori di validazione), quindi niente retry
  automatico che martella.
- Pulizia: job `cron` `rate-limit-cleanup` (03:30) cancella eventi > 7 giorni.
- Non coperto: upload su `storage.objects` (trigger di competenza dello schema
  `storage`; il path foto è già vincolato a `<uid>/…` e ogni foto passa da una
  submission, 1/ora) e traffico anonimo (anon non ha INSERT).

## Anti-spam sul testo (#84)

Trigger `guard_court_text_spam` su `courts` (INSERT e UPDATE di nome/indirizzo,
solo righe con `submitted_by`, cioè proposte community): rifiuta nome o
indirizzo che contengano un link (`http://`, `https://`, `www.`, `t.me/`,
`bit.ly/`). Il campo è un nome di campetto: un link è spam per definizione.
Lunghezze e caratteri di controllo erano già validati in `submit_court`
(nome ≤ 120, indirizzo ≤ 200 stampabile senza newline, `photo_path` senza
`..`/`\`/path assoluti).

## Grant al minimo (#84, migrazione `035`)

Supabase assegna `ALL` ad `anon`/`authenticated` su ogni tabella nuova di
`public`. La RLS protegge le righe, ma il privilegio resta: un `USING (true)`
scritto male, o una tabella senza RLS, diventano scrivibili. La `035` tiene
solo ciò che l'app chiama davvero:

| Tabella | anon | authenticated |
|---|---|---|
| `courts`, `court_submissions`, `court_rating_summary` | SELECT | SELECT |
| `profiles` | SELECT | SELECT, UPDATE |
| `check_ins` | SELECT | SELECT, INSERT, UPDATE (checkout) |
| `court_reports` | SELECT | SELECT, INSERT |
| `lobbies` | SELECT | SELECT, INSERT, UPDATE (creatore) |
| `lobby_participants` | SELECT | SELECT, INSERT, DELETE |
| `court_reviews` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `push_notifications` | — | SELECT, UPDATE (`read_at`) |
| `push_subscriptions` | — | SELECT, INSERT, UPDATE, DELETE |
| `user_favorites` | — | SELECT, INSERT, DELETE |
| `rate_limit_events` | — | — |

La scrittura via RPC (`submit_court`, `approve_court`, `resubmit_submission`,
…) resta possibile: gira `SECURITY DEFINER` come owner, non col privilegio del
chiamante. `DELETE` su `lobbies` è revocato: chiude il cron, non il client.

### `spatial_ref_sys` (PostGIS) — richiede una query una-tantum

`spatial_ref_sys` non ha RLS ed era scrivibile (INSERT/UPDATE/DELETE) da
`anon`. La tabella è di proprietà di `supabase_admin`, quindi **una migrazione
che gira come `postgres` non può revocarne i privilegi** (Postgres risponde
`WARNING: no privileges could be revoked`). Va eseguita una volta a livello di
progetto, come owner:

```sql
-- SQL editor del progetto (ruolo owner/supabase_admin), una volta per ambiente
REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated;
```

Verificato in locale con `psql -U supabase_admin`; il risultato atteso è
`anon=r/supabase_admin` (solo SELECT). Su staging/prod va ancora eseguita: è
una nota di deploy, non un lavoro di codice.

## Header di sicurezza (`middleware.ts`, `lib/security/headers.ts`)

Su ogni risposta, redirect inclusi:

| Header | Valore | Perché |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | un upload interpretato come HTML è XSS sull'origine dell'app |
| `X-Frame-Options` | `DENY` | clickjacking su "Accedi" |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | niente query string verso l'esterno |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=(), payment=()` | serve solo il GPS del check-in |

**Niente CSP, di proposito.** MapLibre richiede `worker-src blob:`, `img-src`
con i tile host e stili inline (posizionamento canvas): una policy allentata
darebbe falsa sicurezza con il rischio di rompere la mappa. Se serve, va
progettata con `report-only` per una release e poi stretta. Stesso motivo per
cui non c'è `Cross-Origin-Opener-Policy`.

## Moderazione foto e media

- Bucket `court-photos`: INSERT/UPDATE/DELETE solo su path `<uid>/…`
  (`010`, `014`); dopo l'approvazione la foto è congelata per il proponente
  (`014`), solo `service_role` può intervenire.
- La foto non è mai pubblica prima della moderazione: la corte nasce
  `pending`, invisibile ad anon (`courts_select_all`).
- Avatars: stesso schema su `<uid>/…`, resize client 512 px (`025`).
- Orfani: `npm run photos:gc` (dry-run di default, finestra 24 h) — vedi
  `docs/photos-gc.md`.

## WAF / edge rules: non ora

Vercel WAF e rate limiting di piattaforma richiedono piano Pro; il progetto è
su Hobby. Alternative valutate e **non** adottate in questa fase:

- Cloudflare davanti al dominio: richiede cambio DNS e gestione cache tile;
  rimandato a quando ci sarà traffico reale.
- Rate limit nel middleware: aggirabile (il client non passa dal middleware
  per le scritture) e inaffidabile su serverless (memoria non condivisa).
  Tenuto solo come possibile difesa in profondità per `/api/*`, non implementato.

Se in futuro arrivano abusi coordinati, l'ordine è: regole Supabase
(`pg_net`/trigger già presenti) → Cloudflare → WAF Pro.

## Verifica

| Cosa | Comando | Copertura |
|---|---|---|
| Rate limit + anti-spam | `npm run test:rls` (blocco 45) | 5 segnalazioni passano, la sesta no; B indipendente da A; eventi non leggibili dal client; nome con link rifiutato, nome normale accettato |
| Grant | `npm run test:rls` (blocco 46) | matrice dei privilegi presenti + scritture vietate (`courts` UPDATE, `lobbies` DELETE, `push_notifications` anon, `TRUNCATE`) |
| Header | `npx vitest run tests/unit/security-headers.test.ts` | valori e idempotenza |
| Flussi reali | `E2E_WITH_DB=1 npx playwright test --project=e2e` | 62 test: nessuna regressione da grant/limiti |

## Aperti (non in questa lane)

- `spatial_ref_sys` su staging/prod (query sopra) — nota di deploy.
- Quota email e template: `docs/email.md`.
- Backup/rollback e secret: `docs/ci.md` (lane CI).
- Cancellazione account / export dati: `docs/legal/` (lane legal).
