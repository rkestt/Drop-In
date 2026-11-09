---
id: d27
type: infra
hitl: false
claimed: false
blocked_by: [d25, d26]
---
## Question

**Obiettivo.** Visual regression su tutte le schermate implementate, deterministica e in CI per il sottoinsieme senza database. Oggi `test:visual` copre solo due sezioni della styleguide, in locale.

**Prerequisiti.** `d3` (font locali, baseline deterministiche), `d25` (a11y chiusa), `d26` (performance chiusa). Tutte le schermate `d17`–`d24` implementate.

**File coinvolti.**

- `tests/e2e/screens-visual.spec.ts` (nuovo): route, viewport, maschere, clock fisso.
- `tests/e2e/styleguide-visual.spec.ts`: resta; eventualmente condivide gli helper.
- `tests/e2e/helpers/visual.ts` (nuovo): `waitForStablePage(page)` (font pronti, niente animazioni, immagini caricate), `freezeClock(page)`.
- `tests/e2e/helpers/auth.ts` (da `d25`): `storageState` per le route autenticate.
- `playwright.config.ts`: progetto `visual-static` (CI) e `visual-full` (con Supabase).
- `.github/workflows/ci.yml`: eseguire `visual-static` in CI; `visual-full` solo se i secret Supabase sono presenti (job opzionale documentato).
- `package.json`: script `test:visual:full`.
- `docs/design/checklist.md`, `docs/design/workflow.md`: aggiornare il gate visual.

**Schermate e viewport.**

- Route: `/styleguide`, `/~offline`, `/submit-court`, `/`, `/courts/<seed>`, `/lobbies`, `/lobbies/<id>`, `/profile`, `/settings`, `/notifications`, onboarding aperto su `/`.
- Viewport: **360×780**, **768×1024**, **1280×800**.
- Per ogni schermata: uno screenshot della pagina intera, con `animations: "disabled"`, `caret: "hide"`, `maxDiffPixelRatio: 0.01`.

**Determinismo (obbligatorio).**

- Font locali (`d3`); attendere `document.fonts.ready` e il caricamento delle immagini prima dello scatto.
- `page.clock.setFixedTime(new Date("2026-11-09T18:00:00+01:00"))` per orari relativi e date.
- Mascherare: canvas MapLibre, marker, tile, timestamp relativi ("12 min fa"), eventuali dati realtime. Usare `data-visual-mask` sugli elementi instabili, non mascherare l'intera pagina.
- Route con DB: seed deterministico (`npx supabase db reset`), utente di test con `storageState`, lobby/campo creati nel setup con ID noti.
- Niente `waitForTimeout` come unica attesa: usare `expect(...).toBeVisible()` o `waitForFunction`.

**Regole.**

- Le baseline si aggiornano **solo** con `--update-snapshots` dopo review di @designer e con il motivo nella PR. Mai aggiornarle per far passare un test.
- Una schermata nuova aggiunge i suoi 3 scatti nello stesso ticket che la implementa, non in un secondo momento.
- Se una schermata è instabile per natura (mappa, realtime), si maschera la parte instabile e si testa il resto: non si esclude la schermata.

**Acceptance.**

- `npx playwright test tests/e2e/screens-visual.spec.ts` verde due volte di fila in locale.
- `visual-static` verde in CI senza Supabase.
- `visual-full` verde con Supabase up e `E2E_WITH_DB=1`.
- 11 schermate × 3 viewport = 33 baseline committate; diff massimo 1%.
- Aggiornare una baseline senza modifica visiva non produce diff (prova di stabilità).
- `docs/design/checklist.md` e `workflow.md` non dicono più "solo locale"; il gate è chiaro su cosa gira in CI.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design` verdi.

**Comandi di verifica.**

```bash
npx playwright test tests/e2e/screens-visual.spec.ts
npx playwright test tests/e2e/screens-visual.spec.ts   # seconda volta
E2E_WITH_DB=1 npx playwright test tests/e2e/screens-visual.spec.ts
npm run test:visual:full
```

**Riferimenti.** `tests/e2e/styleguide-visual.spec.ts`, `docs/design/workflow.md` (Gate), `docs/design/1.5.md` (F4).

## Resolution

(TBD — chiudere con: schermate coperte, maschere, esito doppio run, esito CI, baseline committate.)
