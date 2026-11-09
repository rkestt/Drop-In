---
id: d7
type: impl
hitl: false
claimed: true
blocked_by: [d5, d6]
status: closed
closed_at: 2026-11-09
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

Implementato per intero (branch `fix/d7-f1`).

**Primitive create.**
- `lib/motion/tokens.ts`: `MOTION` (0.15/0.2/0.25/0.4 s) ed `EASE` (standard/elastic come array) — rispecchiano `:root --motion-*` e `@theme --ease-*` in `app/globals.css`.
- `lib/motion/use-reduced-motion.ts`: `useStableReducedMotion()` — primo render sempre statico (nessun mismatch di idratazione), poi `matchMedia` reale con listener. Quello di Motion (`useReducedMotion()`) fotografa il valore al primo render (in SSR sempre `false`) e non si aggiorna: verificato dal vivo che con reduced motion lasciava il check del pop congelato a `scale(0)`.
- `components/motion/step-transition.tsx`: entra 250ms / esce 200ms, `popLayout` (nessun salto di layout), input mai bloccato.
- `components/motion/success-pop.tsx`: check scala una volta in 400ms, testo fermo da subito, `role="status"`.
- `components/motion/next-highlight.tsx`: ring accent statico + velo che sfuma in opacità (200ms) al primo tap/click/focus; `data-highlight` on/off.

**Pipeline coperte (solo i 3 punti del ticket).**
- Check-in sheet: scambio form → `SuccessPop` con testo d'esito "Check-in effettuato / Check-in attivo fino alle HH:MM" (scadenza 2h da auto-checkout). Entrata/uscita del drawer invariate (Base UI).
- Crea lobby: scambio form → `SuccessPop` ("Lobby creata…"), poi chiusura + reload dopo 1400ms. Drawer invariato.
- Lobby card: se l'utente è nei partecipanti, al posto di "Unisciti" compare `NextHighlight` con Badge `success` "Sei dentro".

**Reduced motion.** Ramo statico in ogni primitiva (testo/stato/outline restano). Verificato con `page.emulateMedia({ reducedMotion: "reduce" })` su demo deterministica in `/styleguide` (sezione Motion → Pipeline, aggiunta per questo ticket, senza dati reali): nessuno dei nodi ha transform/transizioni/animazioni, tutti i testi restano leggibili. Nessun `setInterval`, nessun `infinite`, nessuna durata scritta a mano (il test unitario lo vieta).

**Esiti.** `motion-tokens.test.ts` 10/10; suite unit 91/91; `motion-pipelines.spec.ts` 4/4; `test:a11y` 3/3; drawer+toast 8/8 (nessuna regressione); `lint` 0 errori (1 warning pre-esistente in `scripts/check-design.mjs`), `tsc` pulito, `lint:design` OK (69 file). Snapshot visuali intatti (coprono solo `#colori`/`#scale`).

## Resolution — giro review @oracle (APPROVE WITH NITS)

1. `next-highlight.tsx`: `rounded-inherit` (non generato da Tailwind v4) → `rounded-[inherit]`; il ring segue il raggio del figlio.
2. `check-in-sheet.tsx`: il `setTimeout` nudo (1500ms, pre-esistente) ora usa ref + cleanup nell'effetto di chiusura/unmount, identico a `create-lobby-sheet`. Comportamento visibile invariato.
3. **Percorso 1400ms di `create-lobby-sheet`: non coperto da automazione, per infrastruttura.** Tentato il component test (jsdom + RTL sono installati): la toolchain non trasforma **alcun** `.tsx` nei test — vitest 4 + vite 5.4 + `jsx: preserve` in tsconfig fallisce con "Failed to parse source for import analysis … make sure to not set jsx to preserve", provato anche con un test minimo di 3 righe e con override esbuild. Sistemarlo vuol dire aggiornare la toolchain o darle un tsconfig dedicato: infrastruttura nuova, fuori ticket. Via e2e ugualmente bloccata: niente `mailer_autoconfirm` in locale, niente service-role key, nessun utente confermato — il login via UI non è scriptabile senza scraping di Mailpit. **Rischio scoperto:** il singolo scatto onClose+reload dopo 1400ms e la cancellazione su chiusura anticipata; mitigato da pattern identico al check-in (stessa ref+cleanup), review, e verifica live demandata a @tester con account reale.
4. `COMPONENTS.md`: la voce Motion citava `useReducedMotion`, ora `useStableReducedMotion`. La riga sul perché dell'hook custom era già in `onboarding.md` (fotografa il valore SSR, non si aggiorna).
5. **`lobby-card.tsx` (highlight "Sei dentro"): pronto ma non montato** — nessun import in `app/`: il wiring è in `d20`, non cablato qui di proposito.
