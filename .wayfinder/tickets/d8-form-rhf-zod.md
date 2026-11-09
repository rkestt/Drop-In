---
id: d8
type: impl
hitl: false
claimed: false
blocked_by: [d5]
---
## Question

**Obiettivo.** Una sola definizione delle regole di form, condivisa da client e (quando esisterà) Server Action: `react-hook-form` per lo stato, `zod` per la validazione, errori inline in italiano.

**Contesto.** Oggi la validazione è sparsa: attributi HTML (`required`, `min`, `max`), controlli manuali nei componenti e trigger nel DB. Le regole possono divergere. `react-hook-form`, `zod` e `@hookform/resolvers` sono installati e provati nella styleguide, ma non usati nei form reali.

**File coinvolti.**

- `lib/validation/schemas.ts` (nuovo): `submitCourtSchema`, `createLobbySchema`, `editProfileSchema`, `reportSchema`; messaggi in italiano; export dei tipi `z.infer`.
- `components/court/submit-court-form.tsx` (5 campi + foto + dedup).
- `components/lobby/create-lobby-sheet.tsx` (orario, max giocatori).
- `components/profile/edit-profile-sheet.tsx` (nickname).
- `components/report/report-sheet.tsx` (categoria, descrizione).
- `tests/unit/validation-schemas.test.ts` (nuovo).
- Docs: `docs/design/stack.md` (stato: adottato), `docs/design/patterns/onboarding.md` (validazione allo step), `docs/design/COMPONENTS.md` (input con errore).

**Regole.**

- Lo schema è l'unica fonte: niente `min`/`max`/`pattern` duplicati a mano nell'HTML se lo schema li copre; restano solo gli attributi che servono al browser (es. `inputMode`, `autoComplete`).
- Validazione **allo step/submit**, non a ogni tasto: `mode: "onSubmit"` (o `onTouched` per i campi che lo richiedono), `reValidateMode: "onChange"` dopo il primo errore.
- Errori inline sotto il campo, `aria-invalid` + `aria-describedby` verso il messaggio; il primo errore riceve focus.
- Submit: `disabled` + label in corso durante la richiesta; nessun doppio invio.
- La validazione zod non sostituisce i vincoli del DB: i trigger/RLS restano l'ultima difesa. Se il DB rifiuta, il messaggio resta inline e conserva i dati.
- Non cambiare le regole di prodotto (karma, max 30 giocatori, categoria report): migra quelle esistenti, non inventarne di nuove.
- La foto non entra nello schema zod: il file resta gestito a parte (dimensione/tipo validati come oggi).

**Acceptance.**

- I quattro form usano `useForm` + `zodResolver`; nessuno mantiene `useState` per il valore dei campi testuali (restano `useState` solo per file, loading, errori di rete e stati di successo).
- `tests/unit/validation-schemas.test.ts` copre: max giocatori 1/31/10; orario passato/futuro; nickname vuoto/troppo lungo; categoria report non valida; submit-court senza nome e senza foto.
- Ogni errore è annunciato e visibile: `aria-invalid="true"`, messaggio collegato, focus sul primo campo errato.
- Il submit con dati validi produce lo stesso payload di prima (stesse colonne Supabase).
- Nessuna regressione: bozza submit-court in `sessionStorage` continua a funzionare.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:unit` verdi.
- `@tester` verifica live: submit vuoto, errore, correzione, invio riuscito.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/validation-schemas.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
# manuale: /submit-court (submit vuoto + valido), /courts/<id> (crea lobby, report), /profile (nickname)
```

**Riferimenti.** `app/styleguide/library-showcase.tsx` (esempio form RHF+zod), `docs/design/patterns/onboarding.md` (Step, Conferma), `docs/design/stack.md`.

## Resolution

(TBD — chiudere con: schemi creati, form migrati, casi di test, esito live, eventuali regole lasciate al DB.)
