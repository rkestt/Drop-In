---
id: d8
type: impl
hitl: false
claimed: true
blocked_by: [d5]
status: closed
closed_at: 2026-11-09
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

## Issue GitHub collegate

Assorbite da questo ticket (dedup del Phase 1 review, PR #49):

- #54 `fix(dedup): mask lat/lng/distance/status for non-owned pending courts` —
  i candidati dedup non posseduti non espongono coordinate, distanza e stato.
- #55 `fix(submit): handle masked dedup candidates (null id) in form` — il form
  gestisce i candidati mascherati senza id (niente chiavi `null`).
- #58 `feat(submit): owner retract/edit pending submission path` — il
  proponente può ritirare o modificare una proposta in attesa.
- #59 `docs(moderation): update stale migration 012 status and NULL-opaque notes`
  — allineare la documentazione di moderazione allo stato reale delle migration.

## Resolution

Schemi creati in `lib/validation/schemas.ts` (unica fonte, messaggi in
italiano): `submitCourtSchema` (nome max 120 come DB, regola nome-o-foto via
flag `hasPhoto`, sport = 7 valori UI, superficie da allowlist), `createLobbySchema`
(orario futuro, max giocatori 2–30 coerce), `editProfileSchema` (nickname trim,
max 30, vuoto ammesso = azzera), `reportSchema` (categoria = CHECK DB,
descrizione libera).

Form migrati (i 4): `submit-court-form`, `create-lobby-sheet`,
`edit-profile-sheet`, `report-sheet` — tutti `useForm` + `zodResolver`,
`mode: "onSubmit"`, `reValidateMode: "onChange"`, errori inline con
`aria-invalid` + `aria-describedby`, focus sul primo errore, submit disabilitato
in corso + guardia `submittingRef` anti-doppio-invio. Nessun `useState` per i
valori testuali; bozza `sessionStorage` invariata; payload Supabase invariati;
foto fuori dallo schema; drawer/wrapper intatti.

Test: `tests/unit/validation-schemas.test.ts` (16 casi: max 1/31/10, orario
passato/futuro/vuoto, nickname vuoto/31/trim, categoria non valida/mancante/5
valide, submit senza nome±foto, nome 121, sport/superficie invalidi).
E2E nuovo `tests/e2e/submit-court-validation.spec.ts`: submit vuoto anonimo →
errore inline + focus + `aria-invalid`; digitazione → errore via, zero console
error. Docs: `patterns/onboarding.md` (contratto validazione), `COMPONENTS.md`
(input errore a11y). `stack.md`, `MAP.md`, `1.5.md` non toccati.

Esiti: `vitest run` 10 file/97 test verdi; `lint` 0 errori; `tsc` pulito;
`lint:design` OK (65 file); e2e nuovo 1/1; `a11y` 3/3 (include `/submit-court`).

Regole lasciate al DB: rate-limit submit (1/h), validità percorso foto, ban/karma
lobby, CHECK categoria, lat/lng. Nota: `Sport` TS e UI non includono mai
`'altro'` (DB sì): lo schema enumera i 7 sport UI, nessun comportamento cambiato.
Cambio di prodotto consapevole (d8, richiesto
da @oracle): **orario lobby futuro** — il DB non lo vincolava; una lobby con
orario passato è inutilizzabile, ora il client la blocca (DB invariato).
Test di bordo: −2 min → errore, +2 min → ok. Trim descrizione report spostato
nello schema (`description: z.string().trim()`); "solo spazi" → `""` → payload
`null`, come prima. Reset-on-open lasciato com'è in create-lobby/report
(non richiesto dall'acceptance).
Successo completo con auth+GPS resta verifica manuale.
