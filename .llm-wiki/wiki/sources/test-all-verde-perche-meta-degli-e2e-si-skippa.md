---
type: source
title: "test:all verde perché metà degli e2e si skippa senza E2E_WITH_DB"
slug: test-all-verde-perche-meta-degli-e2e-si-skippa
status: insight
category: "source"
created: 2026-11-17
updated: 2026-11-17
---

# test:all verde perché metà degli e2e si skippa senza E2E_WITH_DB

Verificato il 2026-11-17 su HEAD `16def98`, girando `playwright test --project=e2e` con Supabase locale su.

## Il fatto

`npm run test:all` esegue `playwright test --project=e2e`, che **non imposta** `E2E_WITH_DB`. I describe autenticati si gate-ano su quella env e finiscono in skip:

- `tests/e2e/a11y.spec.ts:196` — `!process.env.E2E_WITH_DB` → skip dell'intero blocco "accessibility (axe) — autenticate"
- `tests/e2e/hydration.spec.ts:112` — stesse guardie sulle pagine con sessione
- `tests/e2e/drawer-nickname.spec.ts:33` — drawer con sessione

Nella run: 72 test, 15 verdi, la maggior parte delle restanti in `-` (skip).

Controprova, stesso HEAD: con `E2E_WITH_DB=1` **72/72 verdi in 4m18**. I test autenticati passano — il buco è che il gate non li chiede, non che siano rotti.

Ticket: #98.

## Perché conta

Il gate resta verde anche quando metà della copertura non gira: non è rosso, è **assenza di prova**. Una lane che tocca auth, lobby o profilo può chiudere un ticket con `test:all` verde senza che nessun test autenticato sia passato.

## Cosa fare quando si verifica una lane con sessione

```bash
E2E_WITH_DB=1 npx playwright test --project=e2e
```

(la sola variante già codificata è `test:visual:full` in `package.json:19`)

## Related

- [[playwright-pan-maplibre-senza-drag]]
- [[obs-2026-09-01-harness-hardening-tracker-git-husky-ci-lint-zero]]
