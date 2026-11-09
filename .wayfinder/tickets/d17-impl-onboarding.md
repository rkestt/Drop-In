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

(TBD — chiudere con: chiavi localStorage, passi implementati, esito reduced motion, screenshot, spec.)
