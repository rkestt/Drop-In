---
type: source
title: "Vercel: l'alias custom non segue la release"
slug: vercel-alias-custom-non-segue-la-release
status: insight
category: "source"
created: 2026-11-12
updated: 2026-11-12
---

# Vercel: l'alias custom non segue la release

# Vercel: l'alias custom non segue la release

## Sintomo
Dopo un deploy di branch, l'alias custom (qui `drop-in-stage.vercel.app`) continua a servire il **build precedente**: un tester live non vede le modifiche appena pushate e sembra un bug del codice. Verificato il 2026-11-12: alias fermo a un deploy di 19 ore prima, mentre l'alias di branch `drop-in-git-stage-…` aveva già il build nuovo.

## Perché
Vercel aggiorna da solo l'alias **di branch** (`<project>-git-<branch>-<team>.vercel.app`). Un alias **custom** assegnato a mano resta puntato al deployment su cui è stato creato: nessun auto-follow.

## Fix / abitudine
```bash
npx vercel ls drop-in --yes            # primo URL = deployment più recente
npx vercel inspect <url>               # conferma a quale branch è legato
npx vercel alias set <url> drop-in-stage.vercel.app
```
Da fare **dopo ogni release** che deve finire su staging, e comunque prima di ogni verifica live.

## Come accorgersene senza browser
I due host servono chunk diversi: estrarre i `/_next/static/chunks/*.js` dal HTML e confrontarli (`comm -23/-13`). Se gli hash di `app/(app)/page-*.js` differiscono, i build sono diversi. I testi dei componenti client non compaiono nell'HTML iniziale, quindi cercarli nella pagina non serve.

## Related
- `staging-env-vercel-preview-supabase-free` (setup staging/prod di Drop-In)
- `docs/staging.md` (procedure)
