---
type: source
title: "Visual regression: falso verde quando next/font non applica i font"
slug: visual-regression-falso-verde-font-non-applicati
status: insight
category: "source"
created: 2026-11-09
updated: 2026-11-09
---

# Visual regression: falso verde quando next/font non applica i font

# Visual regression: falso verde quando i font non vengono applicati

## Sintomo
Baseline Playwright verdi per giorni, poi rosse "di colpo" su tutte le viewport dopo merge non correlati (drawer/toast). Diff = shift sub-pixel di ~1px, non un redesign.

## Causa
Le baseline erano state catturate in una run in cui `next/font/local` non applicava i font: il `body` ricadeva sul system sans e il test confrontava sistem-font contro sistem-font. In quel modo una baseline sbagliata resta verde per sempre.

## Fix (Drop-In, commit 5288b31)
- Dopo `document.fonts.ready`, asserire il font reale nel test visivo:
  `expect(getComputedStyle(document.body).fontFamily.toLowerCase()).toMatch(/source\s?sans/)`
  (next/font normalizza in `sourceSans`, senza spazio).
- Rigenerare una volta le baseline con i font applicati e verificare due run di fila.

## Regola
Un test di screenshot senza un'asserzione sull'ambiente (font, tema, viewport, feature flag) può fissare per sempre il rendering sbagliato. Asserisci la precondizione, non solo il pixel.

## Related
- `docs/design/1.5.md` (d3), `.wayfinder/tickets/d3-visual-ci-fonts.md`
