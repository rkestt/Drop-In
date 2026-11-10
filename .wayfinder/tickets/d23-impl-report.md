---
id: d23
type: impl
hitl: false
claimed: false
blocked_by: [d15, d5, d6]
---
## Question

**Obiettivo.** Implementare la segnalazione approvata in `d15`: drawer con categorie reali, descrizione breve, esito con scadenza, stato "già segnalato". Fine del successo che chiude da solo dopo 1,5s e del messaggio generico.

**Prerequisiti.** Prototipo `docs/design/prototypes/report.html` approvato (leggi la Resolution di `d15`). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `components/report/report-sheet.tsx` → `report-drawer.tsx`: drawer, chip categorie, textarea 280, errori inline, stati.
- `components/report/report-button.tsx`: label "Segnala", disabled se l'utente non è loggato (con spiegazione, non nascosto).
- `components/report/reported-courts-indicator.tsx`: resta l'indicatore globale; aggiungi il conteggio per campo se il prototipo lo prevede.
- `app/(app)/courts/[id]/page.tsx`: passa le segnalazioni attive del campo (query server o client) e il flag "già segnalato dall'utente".
- `lib/reports/active.ts` (nuovo, puro): filtra per `expires_at > now`, formatta la scadenza, sceglie l'etichetta della categoria.
- `tests/unit/reports-active.test.ts` (nuovo).
- `docs/design/specs/segnalazioni.md` (nuovo).

**Comportamento.**

- Categorie esatte: `broken_hoop`, `wet_court`, `lighting`, `occupied`, `other` (vincolo DB). Etichette: "Canestro rotto", "Campo bagnato", "Illuminazione", "Occupato", "Altro".
- Categoria obbligatoria; descrizione facoltativa, max 280 caratteri con contatore.
- `expires_at` = ora + 48h (come oggi); il successo mostra la data/ora reale, non "inviata!".
- "Già segnalato": se esiste una segnalazione attiva dello stesso utente per lo stesso campo, il drawer mostra categoria e scadenza e **non** permette un secondo invio. Il pulsante apre lo stato, non un form vuoto.
- Dopo l'invio: drawer chiuso, la scheda campo mostra la segnalazione attiva; niente chiusura automatica a tempo.
- Errore rete: messaggio + "Riprova", categoria e testo conservati.
- Non loggato: il pulsante spiega "Accedi per segnalare" e apre il login (gate d'ingresso, non a metà form).

**Regole.**

- Una sola CTA primaria: "Invia segnalazione".
- Il selettore categoria è un radiogroup accessibile (o bottoni `aria-pressed`, una sola scelta); non radio nascosti.
- Il testo è facoltativo; non bloccare l'invio se manca.
- Nessuna foto (non c'è storage per le segnalazioni).
- Nessun colore hardcoded; nessun token nuovo.

**Acceptance.**

- `tests/unit/reports-active.test.ts` copre: scaduta, attiva, categoria sconosciuta, formattazione data.
- Invio reale: riga in `court_reports` con `expires_at` a +48h; la UI mostra la scadenza.
- Secondo invio per lo stesso campo/utente dentro la finestra: bloccato con spiegazione, nessuna riga duplicata.
- Non loggato: gate di accesso corretto, nessun errore generico.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/reports-active.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /courts/<id> → segnala, invia, riapri, verifica "già segnalato"
```

**Riferimenti.** `supabase/migrations/001_initial_schema.sql` (`court_reports`), `docs/design/prototypes/report.html`, `docs/design/patterns/onboarding.md` (errori con recovery).

## Resolution

**Stato: implementato e verificato (2026-11-10, branch `fix/d23-f3`).**

- **File.** `components/report/report-sheet.tsx` → `components/report/report-drawer.tsx`
  (rename); `components/report/report-button.tsx` (gate login + props);
  `app/(app)/courts/[id]/page.tsx` (scadenze reali, badge "Tua");
  `lib/reports/active.ts` (nuovo, puro); `tests/unit/reports-active.test.ts`;
  `docs/design/specs/segnala-campo.md` (il ticket chiedeva `segnalazioni.md`,
  creato `segnala-campo.md` su istruzione orchestratore).
- **Categorie.** Le 5 del CHECK DB, etichette dalla copy approvata; nessuna inventata.
- **Già segnalato.** Come nel prototipo: due report attivi di utenti diversi
  restano possibili; se l'utente ha una sua attiva, il drawer mostra la lista
  (badge "Tua" sulla propria, scadenze reali) + notice e solo "Chiudi".
  Blocco doppio invio su due livelli: ricontrollo pre-insert
  (`court_id+user_id+expires_at>now`, il DB non ha vincolo di unicità) +
  guardia anti-doppio-submit. Verificato: seconda apertura → stato
  già-segnalato, nessuna riga duplicata per lo stesso utente.
- **Scadenza.** `expires_at` = ora + 48h (`reportExpiryFromNow`, `REPORT_TTL_MS`);
  toast "Segnalazione inviata / Resta attiva fino al 12 nov, 13:28." (data reale);
  scheda campo "Scade il …". Riga DB verificata: `expires_at` a +48h (±5 min).
- **Esiti.** Drawer chiuso al successo + Sonner; niente chiusura a tempo, niente
  messaggio generico. Errore rete: banner inline + CTA "Riprova", valori conservati.
  CTA "Invia" sempre attiva a form vuoto (scelta approvata 2026-11-10).
  Non loggato: pulsante visibile, apre il LoginModal (gate d'ingresso),
  hint sr-only "Accedi per segnalare".
- **Verifiche.** `lint` 0 errori · `tsc` pulito · `lint:design` OK (71 file) ·
  `vitest` 12 file/121 test · `a11y` 3/3 · journey Playwright live 360/768 verde
  (login, form vuoto, errore inline, invio reale, già-segnalato, console pulita).
- **Scostamenti dal prototipo (dichiarati).**
  1. `lib/validation/schemas.ts`: aggiunti `REPORT_DESCRIPTION_MAX = 280` e
     `.max()` (mancava: senza, l'errore >280 non poteva scattare; nessun'altra
     regola toccata).
  2. Messaggio categoria vuota = "Seleziona una categoria." (testo dello schema
     d8, invariato perché il file è vincolato) invece di "Scegli cosa non va".
  3. Nessun frame "Inviato" dentro il drawer: il ticket chiede drawer chiuso +
     scheda aggiornata, l'esito con scadenza viaggia su Sonner (come da vincoli).
- **Nota pre-esistente (non toccata, da valutare a parte).** Con
  `NEXT_PUBLIC_SUPABASE_URL=/supabase`, la chiave cookie del browser è
  `sb-localhost-auth-token` mentre il server cerca `sb-127-auth-token`
  (fallback `127.0.0.1` in `lib/supabase/url.ts`): navigando da `localhost` il
  SSR non vede mai la sessione (fail-open → logged-out). Verificato via
  `127.0.0.1`, dove tutto funziona. Fix fuori scope d23.

**Review oracle (APPROVE WITH NITS) — chiusi 2026-11-10.**

1. Spec: tolta "Scegli cosa non va", resta solo "Seleziona una categoria."
   (stringa reale dello schema).
2. `existingError` del ricontrollo pre-insert ora rilanciato nel catch.
3. Banner rete a copy fissa, senza `{error}`; il tecnico va in
   `createLogger("report")` (mai inglese Supabase in UI).
4. `useEffect` su `open`: anche `reset()` del form; i valori si conservano
   solo dentro il ramo errore-rete (drawer mai chiuso lì).
5. Query report: `select("id, category, expires_at, user_id")`, niente più
   `*` (la `description` non esce dal DB); `user.id` senza `?.` nel ramo truthy.
6. Ramo `signedIn=false` di `ReportButton`: difesa in profondità. In questa
   pagina il bottone è reso solo nel ramo `user` e l'anonimo vede `LoginPrompt`
   (gate invariato); il ramo serve se la sessione scade a drawer chiuso o il
   bottone viene riusato altrove — apre il login invece di un form a metà.
