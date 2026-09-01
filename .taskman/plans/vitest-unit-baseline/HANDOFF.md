# Vitest unit baseline

## Perché
Coprire la logica pura esistente prima di toccarla con i fix E2E. Base di regressione.

## Target test (logica pura ESISTENTE, non inventare)
- `lib/utils.ts` (cn, helpers) — 100% rami.
- Helper bbox in `app/(app)/page.tsx` (`bboxInside` e simili): se inline nel componente, estrarre in `lib/geo.ts` SOLO se testabili senza React (refactor minimo, surgical). Altrimenti testare via import diretto se esportati.
- Formattazioni date/distanza dove presenti (cercare in lib/ e components/**/utils).
- `lib/supabase/database.types.ts`: test di sanità (tabelle chiave esistenti nei types) — cheap, previene drift schema.

## Regole
- NO component testing, NO jsdom. Solo node environment.
- Se una funzione non è estraibile senza refactor rischioso → nota nel report, NON forzare.

## Verification gate
- `npm run test:unit` → tutti verdi, ≥ 10 assertion totali.
- `npx tsc --noEmit` → exit 0.

## Precondition
Possibile estrazione `bboxInside` da page.tsx: Proof: `grep -n "bboxInside\|function.*[Bb]box" app/(app)/page.tsx lib -r` → stabilire dove vive; se non esportata e inline, valutare estrazione minimale. Nessuna rimozione simboli prevista — Precondition: none per cancellazioni.