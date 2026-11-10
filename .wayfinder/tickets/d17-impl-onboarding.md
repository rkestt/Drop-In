---
id: d17
type: impl
hitl: false
claimed: false
blocked_by: [d9, d5, d6]
---
## Question

**Obiettivo.** Implementare il primo avvio approvato in `d9`: 3 passi sopra la mappa, una volta sola, skippabili, più il coach mark del check-in. Nessuna route nuova, nessun tour bloccante.

**Prerequisiti.** Prototipo `docs/design/prototypes/onboarding.html` approvato (leggi la Resolution di `d9`: le modifiche richieste lì sono vincolanti). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `components/onboarding/first-run.tsx` (nuovo, client): drawer a 3 passi, stepper testuale, skip, focus trap, safe-area.
- `components/onboarding/coach-mark.tsx` (nuovo): coach mark contestuale, una volta per feature, dismissibile, non copre il controllo che spiega.
- `lib/onboarding/storage.ts` (nuovo, puro): `hasSeen(key)`, `markSeen(key)` con gestione `localStorage` non disponibile (SSR/privacy mode), chiavi `dropin:onboarded:v1`, `dropin:coach:check-in`.
- `tests/unit/onboarding-storage.test.ts` (nuovo).
- `app/(app)/page.tsx`: monta `<FirstRun />` dopo il primo render della mappa (non blocca il caricamento dei dati).
- `app/(app)/courts/[id]/page.tsx`: avvolge `CheckInButton` con `<CoachMark feature="check-in">`.
- `docs/design/specs/onboarding.md` (nuovo): obiettivo, stati, copy, a11y.

**Comportamento.**

- Apertura solo se `dropin:onboarded:v1` non è impostato **e** l'utente non ha già chiuso il drawer in questa sessione.
- "Salta" e l'ultimo passo scrivono la chiave e chiudono; nessuna chiamata al server.
- Il drawer non copre più del 70% dell'altezza. La mappa resta **visibile** dietro il backdrop, ma non è tappabile finché il drawer è aperto (comportamento standard del dialog).
- Passi: come nel prototipo approvato; il testo del prototipo è definitivo.
- Coach mark: compare solo la prima volta che si apre la scheda di un campo, dopo il primo render; si chiude con "Ho capito" o X; 44px; non riappare.
- Reduced motion: cambio passo istantaneo, nessun pop.
- Nessun layout shift all'apertura (il drawer è un portal, non sposta la mappa).

**Regole.**

- Niente route `/onboarding`, niente redirect, niente blocco dell'app: chi ha fretta deve poter usare la mappa subito.
- Nessun dato finto: nessun nome utente inventato, nessun campo demo.
- Il coach mark non spiega un errore e non copre il bottone.

**Acceptance.**

- Prima visita: il drawer appare una volta; dopo "Salta" o fine, reload → non riappare.
- `localStorage` disabilitato (Safari privato): nessun crash, il drawer si chiude e non blocca l'app.
- Stepper: "Passo 1 di 3", `aria-current="step"`, leggibile senza colore.
- Focus: all'apertura va sul titolo; `Tab` resta dentro; `Esc` chiude e segna come visto; il focus torna al trigger.
- Coach mark: appare una volta, non copre il bottone, chiude con tastiera.
- Reduced motion verificato con DevTools.
- `npx vitest run tests/unit/onboarding-storage.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi.
- `@tester` verifica live 360/768, screenshot, console pulita.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/onboarding-storage.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: localStorage.clear(); reload "/" → 3 passi; ripeti dopo il skip; apri /courts/<id> → coach mark
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (coach mark), `docs/design/1.5.md` (F3), `docs/design/prototypes/onboarding.html`.

## Resolution

**Implementato (2026-11-10, branch `fix/d17-f3`).** File creati:
`lib/onboarding/storage.ts` (`ONBOARDED_KEY="dropin:onboarded:v1"`,
`coachKey()`/`COACH_CHECKIN_KEY="dropin:coach:check-in"`, `hasSeen`/`markSeen`),
`components/onboarding/first-run.tsx` (drawer Base UI a 3 passi, stepper
testuale + `aria-current="step"`, skip/indietro 44px, nota login inline),
`components/onboarding/coach-mark.tsx` (`role="note"`, nel flusso sopra il
controllo, chiusura Ho capito/X/Esc con focus restore),
`tests/unit/onboarding-storage.test.ts` (9 test),
`docs/design/specs/onboarding.md`. Modificati: `components/ui/drawer.tsx`
(passthrough `labelledBy`/`describedBy`/`initialFocus`), `app/(app)/page.tsx`
(`<FirstRun />`), `app/(app)/courts/[id]/page.tsx` (coach sul blocco azioni).

**Scostamento dal ticket (1):** il coach avvolge il blocco azioni invece del
solo `CheckInButton` — la scheda campo si apre anche senza login (mostra
`LoginPrompt`) e l'acceptance chiede il coach alla prima apertura; da loggato
punta comunque al bottone Check-in. Copy, passi, stati invariati dal prototipo.

**localStorage:** ogni accesso in try/catch + guard `typeof window`; se
indisponibile (SSR/Safari privato) `hasSeen` → false, `markSeen` → no-op,
chiusura valida per la sessione (`dismissedThisSession`), nessun crash.
**Reduced motion:** cambio passo via `StepTransition` (ramo statico, nessun
transform inline) + media query globale; verificato con
`emulateMedia({reducedMotion:"reduce"})`, info in testo/focus invariati.

**Esiti:** vitest 12 file/118 test OK · `lint` 0 errori (1 warning
preesistente in `scripts/check-design.mjs`) · `tsc` OK · `lint:design` OK
(73 file) · `a11y` 3/3 OK · Playwright live su 3111: drawer primo avvio 360,
3 passi, skip/Esc, reload non riappare, coach una volta con focus restore,
console pulita. Screenshot: `/tmp/opencode/d17-step-{1,2,3}-360.png`,
`d17-step-1-768.png`, `d17-coach-360.png`.

**Follow-up review oracle (APPROVE WITH NITS, 2026-11-10).**
1. Login cablato: `FirstRun` accetta `onLogin`; il passo 3 chiama
   `page.tsx → setShowLogin(true)` (riuso `LoginModal`, nota inline rimossa).
   L'onboarding si chiude prima (segnato come visto: i 3 passi sono stati
   letti) e il login apre in un microtask — niente modali a catena. Caso
   login verificato live: passo 3 → «Accedi per salvare i progressi» → drawer
   «Accedi» visibile, onboarding chiuso e non riapparso al reload.
2. Focus di ritorno: `Drawer` ora passa anche `finalFocus`; `FirstRun`
   accetta `returnFocusRef` e la pagina passa la regione mappa
   (`tabIndex={-1}`, senza anello). Verificato live: dopo Esc/Salta il focus
   è sulla `div` mappa, mai sul `body`. Nessun furto: il drawer è modale,
   alla chiusura non c'è interazione altrove in corso.
3. Coach: flag di sessione per feature come in `FirstRun`.
4. Spec allineata (coach sul blocco azioni, focus di ritorno, login).

**Nit review oracle (2026-11-10).**
1. Login cablato (vedi sopra): passo 3 → `onLogin` → `LoginModal`; nota
   inline rimossa; niente modali a catena (chiusura + microtask).
2. Focus di ritorno al FAB «Aggiungi un campo» (`finalFocus`, foglia
   stabile): il contenitore mappa è scartato perché Base UI lo risolve al
   primo figlio tabbabile (canvas o select a seconda del caricamento: non
   deterministico, verificato live). Verificato: Esc → focus sul FAB, mai
   sul `body`. Nota: il dialog login non espone accessible name (wart
   preesistente di `LoginModal`, fuori scope).
3. Coach con flag di sessione per feature.
4. Spec aggiornata. 5. (questo paragrafo).

**Riverifica nit:** vitest 12/118 OK · lint 0 errori · tsc OK · lint:design
OK · `test:a11y` 3/3 OK · Playwright 3111 (config in /tmp): login-flow OK
(dialog «Continua con Google», onboarding chiuso, reload pulito, console
pulita), focus-return OK (FAB focalizzato dopo Esc).

