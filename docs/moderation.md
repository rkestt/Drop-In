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

Le scritture su `courts`/`court_submissions` passano solo dal RPC `submit_court`, perché `005_grants_fix.sql` dava DML blanket ad `authenticated` e la 010 lo revoca su quelle due tabelle (`REVOKE INSERT, UPDATE, DELETE ... FROM authenticated, anon`).

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

**Verificato:** le guardie degli RPC usano `auth.role()`/`auth.uid()`, che senza JWT restituiscono NULL; in quel contesto l'`IF ... RAISE` non scatta, quindi i comandi funzionano da Studio/psql. Test reale eseguito: corte pending creata via psql, `approve_court` chiamato da psql come `postgres`, stato cambiato in `approved`, poi riga rimossa. Nessun workaround necessario (`set local request.jwt.claims` non richiesto).

## Promuovere un moderatore

```sql
UPDATE profiles SET is_moderator = true WHERE user_id = '<uuid>';
```

Eseguito da Studio/psql. Il trigger `guard_profile_moderator` blocca la stessa modifica se fatta da una sessione `authenticated` (self-promotion). In Phase 1 non esiste nessun moderatore di default: la coda si smaltisce da Studio. Admin UI è Phase 3.

## Rate limit

1 invio/ora per utente, verificato dentro `submit_court` (`v_recent >= 1` su `court_submissions` degli ultimi 60 minuti). Messaggio d'errore utente: `Hai gia inviato un campo nell ultima ora. Riprova piu tardi.` Non è un job, non si resetta a mano se non cancellando la riga.

## Stato del materiale rifiutato

La corte resta nel DB con `moderation_status='rejected'` e NON è visibile al pubblico (RLS). Il posto può essere riproposto da un altro utente. `dedup_candidates` esclude `rejected` e `duplicate`, ma vede le `pending`: altrimenti si duplica una proposta già in coda.

## Storage

Bucket `court-photos`: pubblico in lettura, 5 MB, solo `image/jpeg|png|webp`. Scrittura consentita solo sotto il prefisso `{auth.uid()}/`. `submit_court` valida che `p_photo_path` inizi con quell'UUID, altrimenti rifiuta.

## dedup_candidates e accesso

`dedup_candidates` è concesso solo ad `authenticated` (non ad `anon`). Un anonimo non deve poter enumerare le corti pending per posizione; le pending sono visibili al suo interno proprio perché deve confrontarci una proposta in arrivo.

## Bypass documentato

Chiamando i RPC da psql/Studio come `postgres` i claim JWT sono assenti, `auth.role()` è NULL e `IF NULL THEN` non scatta, quindi le guardie lasciano passare. È una proprietà nota, non una scorciatoia consigliata: richiede accesso diretto al DB, mentre PostgREST imposta sempre i claim, quindi dal browser non è raggiungibile.

## Limiti noti

- Nessuna UI di moderazione (Phase 3).
- Nessuna notifica all'utente sull'esito.
- Nessuna scadenza automatica delle proposte pending.
- Nessun limite di coda.