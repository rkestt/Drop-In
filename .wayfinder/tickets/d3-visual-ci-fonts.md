---
id: d3
type: infra
hitl: false
claimed: false
blocked_by: []
---
## Question

**Obiettivo.** Rendere deterministici i font e riabilitare la visual regression in CI, così `test:visual` non è più "solo in locale".

**Contesto.** `app/layout.tsx` usa `next/font/google` (`Syne`, `Source_Sans_3`). In sviluppo i file arrivano da Google e il rendering non è identico tra macchina e runner: per questo `test:visual` è escluso dalla CI e `workflow.md` / `checklist.md` lo dichiarano locale. Finché è così, ogni schermata nuova può rompere il layout senza che nessuno se ne accorga.

**File coinvolti.**

- `app/fonts/` (nuovo): `Syne-*.woff2` (400–800) e `SourceSans3-*.woff2` (400–700), con `OFL.txt`.
- `app/layout.tsx`: da `next/font/google` a `next/font/local`, stesse variabili `--font-syne` / `--font-source-sans`, `display: "swap"`, `adjustFontFallback: false`.
- `tests/e2e/styleguide-visual.spec.ts`: attendere `document.fonts.ready` prima dello screenshot, non un `waitForTimeout(300)`.
- `.github/workflows/ci.yml`: aggiungere `npx playwright test tests/e2e/styleguide-visual.spec.ts` dopo `a11y.spec.ts`.
- `docs/design/workflow.md`, `docs/design/checklist.md`: togliere "non gira in CI" e documentare il nuovo gate.

**Come procurarsi i font.** Scaricare i `.woff2` da Google Fonts (licenza OFL, già usata dal progetto) e committarli: **nessuna richiesta a runtime**. Il ticket non introduce un pacchetto npm nuovo.

**Acceptance.**

- Il build non contiene riferimenti a `fonts.googleapis.com` o `fonts.gstatic.com`.
- In Playwright, il log delle richieste di `/styleguide` non contiene host di font esterni.
- `document.fonts.ready` si risolve prima dello screenshot e il testo renderizzato usa il font locale: due run producono gli stessi pixel.
- `performance.getEntriesByType("resource")` non elenca `fonts.googleapis.com` né `fonts.gstatic.com`.
- `npm run test:visual` verde **due volte di fila** sulla stessa macchina, e verde nel job CI con le baseline Linux già committate.
- Le baseline cambiano una volta sola (per il passaggio ai font locali) nello stesso commit; nessun aggiornamento "a caso".
- `npm run build`, `npx tsc --noEmit`, `npm run lint`, `npm run lint:design` verdi.

**Comandi di verifica.**

```bash
npx tsc --noEmit
npm run build
npm run test:visual
npm run test:visual   # seconda volta: deve restare verde
grep -rn "fonts.g" .next/static 2>/dev/null | head
```

**Riferimenti.** `docs/design/workflow.md` (Gate), `docs/design/checklist.md` (Static checks), `tests/e2e/styleguide-visual.spec.ts`.

## Resolution

(TBD — chiudere con: peso dei font, sezioni coperte, esito CI, eventuali baseline rigenerate.)
