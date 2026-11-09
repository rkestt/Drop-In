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

(TBD — chiudere con: categorie, stati verificati, esito doppio invio, screenshot, spec.)
