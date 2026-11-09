---
id: d7
type: impl
hitl: false
claimed: false
blocked_by: [d5, d6]
---
## Question

**Obiettivo.** Dare alle pipeline un motion che orienta: entrata dello step, highlight del prossimo controllo, success pop. Non decorazione, e mai l'unica fonte dell'informazione.

**Contesto.** I token `--motion-*` e `--ease-*` esistono in `app/globals.css`, ma le animazioni attuali usano durate proprie (`animate-scale-in`, `fadeInUp` 400ms, `successPop` 500ms) e non c'è un componente condiviso. Le regole sono in `docs/design/patterns/onboarding.md` e `tokens.md#motion-per-onboarding`: una sola animazione per cambio di stato, 250ms per lo step, 200ms per l'uscita, 400ms per il successo.

**File coinvolti.**

- `lib/motion/tokens.ts` (nuovo): durate in secondi e curve come array, con commento che rimanda ai token CSS.
- `components/motion/step-transition.tsx` (nuovo): `AnimatePresence` + `motion.div`; props `stepKey`, `children`, `className`.
- `components/motion/success-pop.tsx` (nuovo): check + testo, `--success`, durata `--motion-success`.
- `components/motion/next-highlight.tsx` (nuovo): ring accent persistente che sfuma alla prima interazione.
- Applicazione minima in questo ticket: `components/check-in/check-in-sheet.tsx` (success pop), `components/lobby/create-lobby-sheet.tsx` (uscita/successo), `components/lobby/lobby-card.tsx` (highlight dello stato "Sei dentro").
- `tests/unit/motion-tokens.test.ts` (nuovo): legge `app/globals.css` e verifica che i valori in `lib/motion/tokens.ts` coincidano con `--motion-*` / `--ease-*`.
- Docs: `docs/design/patterns/onboarding.md` (sezione implementazione), `docs/design/COMPONENTS.md`.

**Regole.**

- `useReducedMotion()` di Motion: con reduced motion non si anima nulla; lo stato resta leggibile da testo, colore e outline. Non basta la media query CSS, perché Motion scrive transform inline.
- Una sola animazione per cambio di stato: niente stagger a ogni step, niente loop, niente pulse infinito.
- La transizione non blocca l'input: un tap durante l'animazione vince.
- Le durate non si inventano nei componenti: si importano da `lib/motion/tokens.ts`.
- Non migrare tutte le animazioni esistenti: questo ticket crea le primitive e le usa nelle pipeline; il resto si migra quando si tocca il file.

**Acceptance.**

- `tests/unit/motion-tokens.test.ts` verde (i valori JS coincidono con i token CSS).
- Check-in: al successo appare il pop, dura ~400ms e non si ripete; il testo "Check-in attivo fino alle …" è presente anche senza animazione.
- Crea lobby: l'apertura/chiusura del drawer non lascia il contenuto a metà; nessun salto di layout.
- Join lobby: lo stato "Sei dentro" è evidenziato una volta e l'highlight sparisce al primo tap/focus.
- Con `page.emulateMedia({ reducedMotion: "reduce" })` nessun elemento si muove; tutti gli stati restano leggibili.
- Nessun `animation-iteration-count: infinite` nuovo; nessun `setInterval` per animare.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design` verdi; `@tester` verifica live 360px.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/motion-tokens.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
# manuale: check-in con mock GPS, crea lobby, join; poi DevTools → Rendering → prefers-reduced-motion
```

**Riferimenti.** `docs/design/patterns/onboarding.md`, `docs/design/tokens.md#motion-per-onboarding`, `docs/design/decisions/0003-motion-token.md`.

## Resolution

(TBD — chiudere con: primitive create, pipeline coperte, esito reduced motion, screenshot/video del pop.)
