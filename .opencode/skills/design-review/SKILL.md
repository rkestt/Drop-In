---
name: design-review
description: Read-only visual and accessibility review of a page. Use when the user asks to review UI, check responsive layout, audit accessibility, verify design tokens, or validate a page before merge. Never modifies code and never commits.
---

# Design Review

Review read-only di una pagina: screenshot responsive, accessibilità axe-core,
token del design system. Non modifica codice, non fa commit.

## Quando usarla

- "rivedi questa pagina", "controlla il responsive", "audit accessibilità"
- verifica pre-merge di una pagina o componente visibile
- controllo token design (`npm run lint:design` fallisce o si sospettano colori hardcoded)

## Cosa NON fare

- Non modificare codice (app/, components/, docs/design/ intoccabili qui)
- Non fare commit, non aprire PR, non toccare il database
- Non approvare da sola un merge: il report è un input, la decisione resta umana

## Workflow

1. Assumi il dev server su `http://localhost:3000`; se non risponde, avvialo
   (`npm run dev`) e spegnilo alla fine. Mai lasciare processi appesi.
2. Apri la pagina a 360x780, 768x1024, 1280x800; salva gli screenshot in
   `/tmp/opencode/design-review/<larghezza>x<altezza>.png`.
3. Esegui axe-core su ogni viewport; mappa l'impatto a severità:
   critical/serious → error, moderate/minor → warn.
4. Controlla i token riusando `scripts/check-design.mjs` come sottoprocesso
   (non duplicarne regex o allowlist); ogni sua riga è un error.
5. Produci il report in formato `posizione [severità] messaggio`:
   `file:riga` per lo statico, `url @viewport selettore` per axe;
   salva anche `report.json` accanto agli screenshot.

## Script

```
node .opencode/skills/design-review/scripts/design-review.mjs [--url URL] [--out DIR] [--dry-run]
```

- `--dry-run`: stampa il piano senza browser né server (non distruttivo).
- Exit 1 se c'è almeno un error, 0 se solo warn o tutto verde.

## Severità

- error: viola un gate (token mancante, colore hardcoded, axe critical/serious).
- warn: da sistemare ma non blocca (axe moderate/minor, contrasto borderline).
