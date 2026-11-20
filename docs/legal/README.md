# Legal & privacy — appunti di lavoro (#83)

Stato al 2026-11-16. Le pagine utente esistono (`app/(app)/legal/**`), il testo
è una **bozza tecnica**: i punti `[DA COMPILARE]` vanno completati e validati
da un legale prima dell'apertura al pubblico. Questo file è la checklist e la
fonte dei fatti tecnici (tabelle, retention, fornitori) su cui il testo si
appoggia.

## Pagine pubblicate

| Route | File | Contenuto |
|---|---|---|
| `/legal` | `app/(app)/legal/page.tsx` | indice + come esercitare i diritti |
| `/legal/privacy` | `.../privacy/page.tsx` | informativa GDPR (artt. 13–14) |
| `/legal/terms` | `.../terms/page.tsx` | termini d'uso |
| `/legal/cookies` | `.../cookies/page.tsx` | cookie tecnici + localStorage, nessun tracciamento |

Link in Impostazioni: `components/legal/legal-links.tsx`, montato in
`app/(dashboard)/settings/page.tsx` (sotto la sezione Moderazione/Account).
Nota di ownership: `app/(dashboard)/settings/page.tsx` era assegnato alla lane
a11y; le lane sono state eseguite in sequenza (nessun conflitto), la modifica è
di tre righe (import + componente).

## Inventario dei dati (verificato sullo schema)

| Tabella / sistema | Dati | Chi lo vede | Retention reale |
|---|---|---|---|
| `auth.users` (Supabase) | email, hash password, provider OAuth | solo l'utente + admin | fino a cancellazione |
| `profiles` | nickname, avatar, karma, ban | pubblico (nickname/avatar/karma) | fino a cancellazione |
| `profile_age` | data di nascita (#97) | solo l'utente (+ service role per export/cancellazione) | fino a cancellazione |
| `check_ins` | lat/lng, accuracy, orari, esito | pubblico (policy SELECT aperta) | fino a cancellazione; check-out automatico a 2 h |
| `lobbies`, `lobby_participants` | orari, partecipazione | pubblico | fino a cancellazione (lobby chiusa resta nello storico) |
| `court_reports` | categoria, descrizione, coordinate del campo | pubblico | **48 ore** (`REPORT_TTL_MS`), cron `archive-old-reports` |
| `court_reviews` | stelle (1–5), testo ≤500 | pubblico su campi approvati | fino a cancellazione/rimozione |
| `courts` + `court_submissions` | nome, coordinate, indirizzo, foto, proponente | campi approvati pubblici; pending solo autore/moderatori | fino a cancellazione/rimozione |
| `user_favorites` | corte salvata | solo l'utente | fino a cancellazione |
| `push_subscriptions` | endpoint + chiavi push | solo l'utente (e service role per l'invio) | fino a disattivazione/cancellazione |
| `push_notifications` | titolo, corpo, `read_at` | solo l'utente | fino a cancellazione |
| `storage.objects` (`court-photos`, `avatars`) | immagini | foto campo pubblica se approvata; avatar pubblico | fino a cancellazione/GC orfani (24 h) |
| Log Vercel/Supabase | IP, URL, errori | fornitori | ~1 giorno (piano free) |
| Dump di backup | copia del DB | chi ha accesso allo storage | max 90 giorni (workflow) / 30 di default locale |

Categorie particolari: nessuna (art. 9). Nessuna profilazione, nessun
tracciamento cross-site, nessun cookie non tecnico.

## Fornitori / responsabili del trattamento

| Fornitore | Ruolo | DPA | Note per il testo |
|---|---|---|---|
| Supabase | DB, auth, storage | sì (standard) | verificare regione del progetto |
| Vercel | hosting, log | sì (standard) | funzione/regione EU da confermare |
| Resend (o Brevo) | email auth | da attivare con l'account | finché non attivo, le email di prod non partono (vedi `docs/email.md`) |
| Google | OAuth (opzionale) | termini Google | solo se l'utente sceglie Google |
| OpenFreeMap / OSM | tile mappa | n/a (dati) | ricevono IP e area, non dati account |

Trasferimenti extra-UE: da verificare in base alle regioni scelte; nel testo si
cita SCC art. 46 con un `[DA CONFERMARE]`.

## Punti da far validare (checklist)

- [ ] Titolare: nome/ragione sociale, indirizzo, P.IVA, email dedicata.
- [ ] DPO: necessario o no (art. 37)? Motivare.
- [ ] Email di contatto: `privacy@` e `security@` esistono davvero? Se no,
      usare un indirizzo attivo o un form.
- [ ] Età minima: decisa 14 anni, blocco secco senza percorso di consenso genitoriale (#97); testo nelle pagine da far validare ad Andrea/legale prima della pubblicazione.
- [ ] Foro competente per i non consumatori.
- [ ] Regioni di trattamento Supabase/Vercel e clausole di trasferimento.
- [ ] Testo del consenso push (in app oggi c'è solo il permesso browser).
- [ ] Cookie policy: confermare che non esistono cookie oltre a quello auth
      (verificato nel codice: `SUPABASE_COOKIE_NAME` in `lib/supabase/url.ts`).
- [ ] Se si attiva analytics: banner + aggiornamento privacy/cookie **prima**
      del rilascio.
- [ ] Registro dei trattamenti (art. 30) e valutazione d'impatto (DPIA):
      probabilmente non necessaria, ma va deciso.
- [ ] Termini: chi è il soggetto che eroga il servizio e chi risponde dei
      contenuti della community.
- [ ] Pubblicare la versione validata e rimuovere i `[DA COMPILARE]`.

Verifica automatica dei placeholder:

```bash
grep -rn "DA COMPILARE\|DA CONFERMARE" app/'(app)'/legal
```

Deve restituire vuoto prima della pubblicazione.

## Procedura export / cancellazione (manual, fino al self-service)

Richiesta via `privacy@drop-in.app` → verifica identità (email dell'account) →
entro 30 giorni:

1. **Export** (da eseguire come service role, mai dal client):
   ```sql
   select * from public.profiles where user_id = :uid;
   select * from public.profile_age where user_id = :uid;
   select * from public.check_ins where user_id = :uid;
   select * from public.court_reviews where user_id = :uid;
   select * from public.user_favorites where user_id = :uid;
   select * from public.court_reports where user_id = :uid;
   select * from public.push_subscriptions where user_id = :uid;
   select * from public.push_notifications where user_id = :uid;
   select * from public.court_submissions where submitter_id = :uid;
   select * from public.lobby_participants where user_id = :uid;
   ```
   Consegna un JSON; le foto si scaricano dallo storage (`<uid>/…` in
   `avatars`, eventuali `court-photos`).
2. **Cancellazione**: Admin API `auth.admin.deleteUser(uid)` — le FK sono
   `ON DELETE CASCADE` su profilo, check-in, recensioni, preferiti, notifiche,
   subscription, submissions; le lobby create restano ma senza creatore?
   Verificare caso per caso (`lobbies.creator_id` è `ON DELETE CASCADE`,
   quindi spariscono anche le lobby create). Cancellare poi gli oggetti
   storage dell'utente.
3. **Conferma** all'utente con data e cosa è stato eliminato.

Automazione futura: RPC `delete_my_account()` (SECURITY DEFINER, verifica
`auth.uid()`) + pulsante in Impostazioni con conferma digitata. Richiede una
migrazione (lane security) e un test RLS: non fatta in questa lane per non
inventare una politica di cancellazione senza la validazione legale.

## Cosa manca rispetto a un'app "pronta"

- Pulsante self-service di export/cancellazione (sopra).
- Consenso esplicito e revocabile alle notifiche push dentro l'app (oggi è il
  permesso del browser: sufficiente tecnicamente, da allineare al testo).
- Registro trattamenti e nomina formale dei responsabili (documenti, non
  codice).
- Revisione legale dei testi e rimozione dei placeholder.

## Verifica

| Cosa | Come |
|---|---|
| Pagine raggiungibili, link incrociati, axe 0 violazioni | `npx playwright test tests/e2e/legal.spec.ts` |
| Build/typecheck | `npm run build`, `npx tsc --noEmit` |
| Nessun placeholder dimenticato (prima della pubblicazione) | `grep -rn "DA COMPILARE" app/'(app)'/legal` |
