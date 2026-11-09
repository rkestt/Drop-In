# Drop-In — Design System

Versione: 1.0 (FASE 1: documentazione e token).  
Branch: `openchamber/design-architecture`.

## Fonte di verità

- **Colori, font e token base**: `app/globals.css`.
- **Componenti UI riutilizzabili**: `components/ui/*.tsx`.
- **Pattern e layout**: `app/(app)/page.tsx`, `app/(app)/layout.tsx`, `app/layout.tsx`.
- **Decisioni architetturali**: `docs/design/decisions/`.

Se un file di codice diverge dalla documentazione, la documentazione vince: aprire un ADR o aggiornare il codice.

## Indice

- [Piano design system e schermate](1.5.md)
- [Principi](principles.md)
- [Token](tokens.md)
- [Stack librerie UI](stack.md)
- [Temi](themes.md)
- [Componenti](components/)
  - [Button](components/button.md)
  - [Input](components/input.md)
  - [Badge](components/badge.md)
  - [Bottom Sheet](components/bottom-sheet.md)
  - [Card](components/card.md)
  - [Navigazione + FAB](components/nav.md)
- [Inventario contratti (COMPONENTS.md)](COMPONENTS.md)
- [Eccezioni e buchi (gaps.md)](gaps.md)
- [Spec schermate](specs/)
- [Prototipi statici](prototypes/README.md)
- [Riferimenti esterni](references/)
- [Pattern](patterns/)
  - [Onboarding](patterns/onboarding.md)
  - [Layout](patterns/layout.md)
  - [Stati](patterns/states.md)
  - [Sheet](patterns/sheets.md)
  - [Mappa](patterns/map.md)
- [Accessibilità](accessibility.md)
- [Contenuto e tono](content.md)
- [Workflow](workflow.md)
- [Checklist](checklist.md)
- [Decisioni](decisions/)

## Cosa è vincolante

- Un solo tema, dark. Vietato `data-theme`, toggle o varianti Tailwind `dark:`.
- Colori solo dai token CSS di `app/globals.css`. Vietati colori hardcoded (`#hex`, `rgb()`, `hsl()`, `oklch()`) fuori dai token, salvo fallback standalone o API esterne.
- Mobile-first con breakpoint mentale a 360px.
- Touch target minimo 44px.
- Focus visibile sempre accent.
- Animazioni rispettano `prefers-reduced-motion`.
- Italiano in tutta la UI.

## Come si usa

0. **Se stai per toccare UI, componenti o schermate, parti da qui.** Leggi questa pagina e i file che referenzia (`tokens.md`, `themes.md`, `components/`, `patterns/`, `workflow.md`, `checklist.md`, `patterns/onboarding.md`, `stack.md`): sono vincolanti, non consultivi.
1. Scegli i token dalla tabella in `tokens.md`.
2. Usa i componenti `components/ui/`; se serve una variante, chiedi prima a @designer.
3. Consulta i pattern prima di disegnare una nuova schermata.
4. Apri un ADR per eccezioni o nuovi token.
5. Apri `/styleguide` in sviluppo: token, scale e componenti reali con tutti gli stati, in una pagina sola (non linkata nell'app).

## Stato

- Tema unico dark attivo (`app/globals.css`, `:root`).
- Radius, type scale display e label sono tokenizzati in `@theme`.
- Durate e curve di motion sono token: `--motion-*` in `:root`, `--ease-*` in `@theme`.
- Le librerie UI sono decise ma non installate: vedi [stack.md](stack.md).
- `lint:design` deve essere verde in ogni PR.
