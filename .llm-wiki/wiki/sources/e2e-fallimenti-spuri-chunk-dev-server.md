---
type: source
title: "e2e di Drop-In: fallimenti spuri dal chunk corrotto del dev server, non dal codice"
slug: e2e-fallimenti-spuri-chunk-dev-server
status: insight
category: "sources"
created: 2026-11-18
updated: 2026-11-18
---

# e2e di Drop-In: fallimenti spuri dal chunk corrotto del dev server, non dal codice

# e2e di Drop-In: fallimenti spuri dal chunk corrotto del dev server, non dal codice

Il gate gira sul **dev server** (`/styleguide` è dev-only) con 2 worker fissati e zero riprove. Ogni tanto 2-4 test cadono insieme, sempre su flussi che aprono un drawer o fanno login.

## Firma

Nel log Playwright compare, tra un test e l'altro:

```
[WebServer]  ⨯ [TypeError: __webpack_modules__[moduleId] is not a function]
[WebServer]  ⨯ uncaughtException: [Error: aborted] { code: 'ECONNRESET' }
```

I test poi falliscono su `locator.fill` in attesa di un campo che non arriva: la pagina ha ricevuto un chunk rotto, non un errore logico.

## Come distinguerlo da una regressione

1. il diff non tocca `app/` né `components/` (le migrazioni non c'entrano);
2. rilanciando i 2-3 spec da soli, con il dev server a riposo, passano tutti;
3. il conteggio totale resta corretto (72 test: `passed + failed + did not run`).

Se le tre cose valgono, è ambiente: si rilancia l'intera suite da server pulito e **non** si aggiunge un retry al test — un gate che ogni tanto è rosso per caso insegna a ignorare il rosso.

## Altro caso vicino (personale)

Un `next build` che scrive in `.next` mentre un `next dev` è acceso corrompe i chunk allo stesso modo: vedi la nota sul vault personale (`static-chunks-404`).

## Related

- gate e worker: `AGENTS.md`, sezione *Quality gate*
- `docs/agents/subagent-contract.md`
