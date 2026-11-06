# Moderazione Phase 1 — Drop-In

## Modello

- `courts` ha `moderation_status` ∈ `{pending, approved, rejected, duplicate}` e `source` ∈ `{osm, community}`.
- I campi OSM sono `approved` per costruzione (backfill migration 010).
- `court_submissions` è il registro di audit: una riga per ogni invio, con `status` che segue l'esito.

## Chi può fare cosa

La security della moderazione vive in **una sola** policy RLS su `courts`:

```sql
CREATE POLICY courts_select_all ON public.courts
  FOR SELECT
  USING (moderation_status = 'approved' OR submitted_by = auth.uid() OR public.is_moderator());
```

Distinzione tra INVOKER e DEFINER, verificata su `010_court_submissions.sql`:

- `courts_in_viewport` e `nearby_courts`: **SECURITY INVOKER** (nessuna clausola DEFINER). Ereditano la RLS di `courts` perché girano col ruolo del chiamante, quindi il `SELECT * FROM courts` nel corpo è filtrato dalla policy. È per questo che non c'è nessun `WHERE moderation_status='approved'` nel loro SQL: aggiungerlo creerebbe due posti da tenere allineati.
- `submit_court`, `dedup_candidates`, `approve_court`, `reject_court`, `mark_duplicate`: **SECURITY DEFINER**, per una ragione precisa ciascuno — `submit_court` deve inserire una corte `pending` che la RLS nasconderebbe; `dedup_candidates` deve vedere anche le pending; i tre di moderazione devono poter aggiornare righe che il chiamante non può toccare. Ognuno si difende con la propria guardia (`auth.uid()` obbligatorio, whitelist, rate limit, oppure `auth.role()='service_role' OR is_moderator()`).

Il punto che conta: **la RLS è l'unico layer per la lettura**, le guardie dentro i DEFINER sono l'unico layer per la scrittura. Non ci sono filtri duplicati.

Le scritture su `courts`/`court_submissions` **dal client** passano solo dagli RPC (`submit_court` per gli invii, `approve_court`/`reject_court`/`mark_duplicate` per la moderazione), perché `005_grants_fix.sql` dava DML blanket ad `authenticated` e la 010 lo revoca su quelle due tabelle (`REVOKE INSERT, UPDATE, DELETE ... FROM authenticated, anon`). `service_role` e `postgres` (Studio/psql) scrivono invece direttamente.

## Workflow operativo (Studio / psql)

Coda proposte in attesa:

```sql
SELECT cs.id, cs.created_at, cs.submitter_id, c.id AS court_id, c.name, c.lat, c.lng
FROM court_submissions cs JOIN courts c ON c.id = cs.court_id
WHERE cs.status = 'pending'
ORDER BY cs.created_at;
```

Duplicati possibili di una proposta:

```sql
SELECT * FROM dedup_candidates(<lat>, <lng>, 100);
```

Approvare:

```sql
SELECT approve_court('<uuid_court>');
```

Rifiutare:

```sql
SELECT reject_court('<uuid_court>', '<nota>');
```

Marcare duplicato:

```sql
SELECT mark_duplicate('<uuid_court>', '<uuid_corte_originale>');
```

Effetto su `court_submissions`:
- `approve_court` → `status = 'approved'`
- `reject_court` → `status = 'rejected'`, `moderation_note = <nota>`
- `mark_duplicate` → `status = 'duplicate'`

## Dove si eseguono i comandi in Phase 1

Supabase Studio locale su `http://127.0.0.1:54333` (SQL editor → gira come `postgres`), oppure:

```bash
docker exec -i supabase_db_drop-in psql -U postgres -d postgres
```

**Comportamento diverso per `submit_court` e per gli RPC di moderazione.** `submit_court` rifiuta esplicitamente quando `auth.uid()` è NULL (`Devi essere autenticato per inviare un campo.`), quindi **fallisce** da Studio/psql. Solo `approve_court`/`reject_court`/`mark_duplicate` hanno la guardia NULL-opaca e passano. Test reale eseguito da psql come `postgres`:

```text
SELECT submit_court('Test Psql', 41.9, 12.5);
-- ERROR:  Devi essere autenticato per inviare un campo.

SELECT approve_court('00000000-0000-0000-0000-000000000000');
--  approve_court
-- ---------------
--                 (nessun errore; 0 righe aggiornate su UUID inesistente)
```

Nessun workaround necessario per la moderazione (`set local request.jwt.claims` non richiesto); per `submit_court` non esiste invece scorciatoia da psql: l'invio richiede un JWT `authenticated` (via app/PostgREST).

> **Avviso: da Studio/psql la RLS non si applica.** Il ruolo `postgres` ha `rolbypassrls`, quindi le policy non filtrano: `courts_in_viewport`/`nearby_courts` (e qualunque `SELECT` diretto) restituiscono anche `pending`/`rejected`/`duplicate`. Chi esplora da Studio vede righe che il pubblico non vede; per vedere ciò che vede il pubblico, filtrare esplicitamente `moderation_status = 'approved'`.

## Promuovere un moderatore

```sql
UPDATE profiles SET is_moderator = true WHERE user_id = '<uuid>';
```

Eseguito da Studio/psql. Il trigger `guard_profile_moderator` blocca la modifica di `is_moderator` da **qualunque** sessione con JWT non-`service_role` — non solo l'auto-promozione: anche un moderatore legittimo che provasse a promuovere qualcuno dall'app prenderebbe un `42501` (`Non autorizzato a modificare is_moderator`). Conseguenza operativa: anche con più moderatori attivi, le promozioni si fanno solo da Studio/psql (ruolo `postgres`, senza JWT, o `service_role`). In Phase 1 non esiste nessun moderatore di default: la coda si smaltisce da Studio. Admin UI è Phase 3.

## Rate limit

1 invio/ora per utente, verificato dentro `submit_court` (`v_recent >= 1` su `court_submissions` degli ultimi 60 minuti). Messaggio d'errore utente: `Hai gia inviato un campo nell ultima ora. Riprova piu tardi.` Non è un job. Per resettarlo a mano non basta cancellare la riga di `court_submissions`: la cascade va da `courts` a `court_submissions` (`court_submissions_court_id_fkey ... ON DELETE CASCADE`), non il contrario — cancellando solo la submission resta una corte `pending` orfana, invisibile al pubblico ma ancora visibile al dedup. Cancellare prima la corte (`DELETE FROM courts WHERE id = ...`, che trascina la submission) oppure entrambe le righe.

## Stato del materiale rifiutato

La corte resta nel DB con `moderation_status='rejected'` e NON è visibile al pubblico (RLS). Il posto può essere riproposto da un altro utente. `dedup_candidates` esclude `rejected` e `duplicate`, ma vede le `pending`: altrimenti si duplica una proposta già in coda.

## Storage

Bucket `court-photos`: pubblico in lettura, 5 MB, solo `image/jpeg|png|webp`. Scrittura consentita solo sotto il prefisso `{auth.uid()}/`. `submit_court` valida che `p_photo_path` inizi con quell'UUID, altrimenti rifiuta.

## dedup_candidates e accesso

`dedup_candidates` è concesso solo ad `authenticated` (non ad `anon`). Un anonimo non deve poter enumerare le corti pending per posizione; le pending sono visibili al suo interno proprio perché deve confrontarci una proposta in arrivo.

> **In arrivo (migration 012, non ancora applicata — documentazione anticipatoria).** Le corti non `approved` che non appartengono al chiamante verranno restituite **mascherate** (`id = NULL`, `name = 'Proposta in attesa'`), per chiudere l'enumerazione delle proposte altrui via posizione. Le proprie proposte restano visibili per esteso. Resta invariato il perché le pending si vedono: evitare di duplicare una proposta già in coda — il mascheramento nasconde *di chi* è e *quale* riga sia, non *che* lì c'è già qualcosa.

## Difetto noto: guardie NULL-opache (bypass da psql/Studio)

Chiamando gli RPC di moderazione da psql/Studio come `postgres` i claim JWT sono assenti, `auth.role()` è NULL e `IF NULL THEN` non scatta, quindi le guardie lasciano passare. È un **difetto noto, non una proprietà accettabile**: qualunque chiamante senza claim JWT — incluso un futuro job pg_cron, che gira come `postgres` senza claims — esegue la moderazione senza autorizzazione. Richiede accesso diretto al DB, mentre PostgREST imposta sempre i claim, quindi dal browser non è raggiungibile; resta comunque da correggere.

La correzione è scrivere le guardie con `IS DISTINCT FROM` (deny di default), ad esempio:

```sql
IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
  RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
END IF;
```

Con `IS DISTINCT FROM`, un `auth.role()` NULL **nega** l'accesso invece di lasciarlo passare. Finché la correzione non è applicata, trattare ogni esecuzione da Studio/psql come operazione privilegiata non autenticata.

## Limiti noti

- Nessuna UI di moderazione (Phase 3).
- Nessuna notifica all'utente sull'esito.
- Nessuna scadenza automatica delle proposte pending.
- Nessun limite di coda.