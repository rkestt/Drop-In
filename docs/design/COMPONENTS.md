# COMPONENTS.md — Inventario contratti

Contratti brevi dei componenti esistenti. Dettagli (anatomia, snippet) in `components/`.

## Button — `components/ui/button.tsx`

- **Scopo (task utente):** compiere l'unica azione principale o secondaria di una schermata ("Unisciti", "Crea lobby").
- **NON usarlo per:** link di navigazione (usa `Link` con stile ghost); icone flottanti su mappa (usa il FAB).
- **API pubblica:** `variant` = `primary | secondary | ghost | danger`; `size` = `default | sm | icon`.
- **Stati:** default, hover (`accent-hover` / cambio sfondo / opacity 90), active (`scale-[0.97]`), focus (anello accent 2px + offset), disabled (`opacity-50`, no pointer). Loading non implementato: `disabled` + spinner esterno. Error non esiste: usa `danger`.
- **Token:** `--accent`, `--accent-hover`, `--accent-foreground`, `--bg-surface`, `--text-primary`, `--cool-muted`, `--danger`, `--danger-foreground`, `--radius-control*`.
- **A11y:** una sola CTA accent per schermata; focus sempre visibile; touch target ≥ 44px (`sm` ha `min-h-[44px]`; `icon` è 48px).
- Dettagli: [components/button.md](components/button.md).

## Input — `components/ui/input.tsx`

- **Scopo (task utente):** far digitare testo breve (ricerca campi, nome lobby, segnalazione).
- **NON usarlo per:** selezione da opzioni (usa `SportSelector`); testi lunghi (serve `textarea`, non esiste nel kit: chiedi a @designer).
- **API pubblica:** input a singola variante; errore passando `className` esterno (`border-danger text-danger`).
- **Stati:** default (`bg-surface`, bordo trasparente), focus (bordo + anello accent), filled, disabled (stile browser + opzionale `opacity-50`), error (esterno).
- **Token:** `--bg-surface`, `--text-primary`, `--text-muted` (placeholder), `--accent`, `--danger` (errore).
- **A11y:** label associata (`htmlFor`/`id`) obbligatoria; font 16px (niente zoom iOS); altezza ≥ 44px. Placeholder `--text-muted` su `--bg-surface` = 5,43:1 (AA, vedi [tokens.md](tokens.md)).
- Dettagli: [components/input.md](components/input.md).

## Badge — `components/ui/badge.tsx`

- **Scopo (task utente):** mostrare a colpo d'occhio uno stato (lobby aperta/in corso/chiusa, moderazione).
- **NON usarlo per:** elementi cliccabili (non è un pulsante); numeri grandi o contatori (usa testo Syne).
- **API pubblica:** `variant` = `default | accent | success | warning | danger`.
- **Stati:** nessuno, elemento statico (no hover/active/disabled).
- **Token:** `--bg-surface`, `--text-muted`, `--cool-muted`, `--accent`, `--accent-subtle`, `--success`/`--success-dark`, `--warning`/`--warning-dark`, `--danger`/`--danger-dark`.
- **A11y:** testo 12px maiuscolo — non usarlo per informazioni critiche solo-colore; se lo stato è essenziale, affianca testo o icona con label.
- Dettagli: [components/badge.md](components/badge.md).

## Drawer — `components/ui/drawer.tsx`

- **Scopo (task utente):** dettagli campo, filtri o azioni contestuali, form brevi senza lasciare la mappa.
- **NON usarlo per:** flussi lunghi (usa pagina intera); conferme semplici (usa toast o banner inline).
- **Base:** `@base-ui/react` `Drawer` (una sola primitiva per dialog/drawer; `BottomSheet` non esiste più).
- **API pubblica:** `open`, `onClose`, `title?`, `description?`, `children`, `className?`; chiusura via `Escape`, tap sul backdrop, drag oltre soglia.
- **Stati:** closed (non renderizzato), open, dragging; transizioni Base UI, nessuna animazione custom.
- **Token:** `--bg-elevated`, `--text-primary`, `--text-muted`, `--overlay` (backdrop), `rounded-t-sheet`, `pb-safe`.
- **A11y:** `role="dialog"` + `aria-modal="true"` via Base UI; focus trap che cicla (Tab avanti e indietro), restore focus al trigger, handle 44px `aria-hidden`, scroll del body bloccato, reduced motion globale.
- Dettagli: [components/drawer.md](components/drawer.md), pattern [patterns/sheets.md](patterns/sheets.md).

## Card — pattern (NON componente)

- **Scopo (task utente):** raggruppare informazioni correlate (lobby, dettaglio campo) in liste sotto la mappa. Riferimenti: `components/lobby/lobby-card.tsx`, lista lobby in `app/(app)/page.tsx`.
- **NON usarla per:** un singolo dato isolato (testo o badge); contenitori pienamente interattivi come bottoni (usa Button).
- **API pubblica:** nessuna; pattern `bg-[var(--bg-surface)] rounded-xl p-4 space-y-3`. Item cliccabile in lista: `Link block` con `active:bg-[var(--bg-elevated)]`.
- **Stati:** default; active/pressed (`active:bg-elevated`); focus solo se il container è focusable (anello accent); disabled delegato alle azioni interne.
- **Token:** `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-subtle`, `--danger`.
- **A11y:** se l'intera card è cliccabile, deve essere un unico focus stop con nome accessibile; niente `div onClick`.
- Dettagli: [components/card.md](components/card.md).

## Navigazione + FAB — `app/(app)/layout.tsx`, `app/(app)/page.tsx`

- **Scopo (task utente):** bottom nav = spostarsi tra le sezioni principali (Mappa, Profilo); FAB = azione primaria contestuale della mappa (aggiungi campo).
- **NON usarli per:** più di 5 voci nella nav; azioni secondarie nel FAB (vanno in menu contestuale o sheet).
- **API pubblica:** nessuna; nav `sticky bottom-0` con container `max-w-[720px]`; FAB `absolute bottom-4 right-4 z-30`, `w-14 h-14 rounded-full`.
- **Stati:** nav active (`text-accent`) / inactive (`text-muted`) / focus (anello); FAB default / hover (`accent-hover`) / active (`scale-[0.97]`) / focus (anello).
- **Token:** `--bg-elevated`, `--cool-muted`, `--accent`, `--accent-hover`, `--accent-foreground`, `--text-muted`, `--radius-chip`.
- **A11y:** `aria-label` sul FAB ("Aggiungi un campo"); label 11px (`text-label`) nella nav sempre affiancata all'icona (mai solo-icona); target link 64x48px, FAB 56px.
- Dettagli: [components/nav.md](components/nav.md).

## Motion pipeline — `components/motion/*` + `lib/motion/tokens.ts`

- **Scopo (task utente):** orientare nelle pipeline: entrata dello step, esito di successo, highlight del prossimo controllo o dello stato appena conquistato. Mai decorazione, mai unica fonte dell'informazione.
- **NON usarle per:** animazioni fuori pipeline (resta `--motion-fast` o le classi esistenti); loop, pulse, stagger a ogni step; animazioni di ingresso/uscita del drawer (restano quelle di Base UI).
- **API pubblica:** `StepTransition({ stepKey, children, className? })`; `SuccessPop({ title, description?, className? })`; `NextHighlight({ children, className? })`; `MOTION = { fast: 0.15, base: 0.2, slow: 0.25, success: 0.4 }`, `EASE = { standard, elastic }` (array cubic-bezier).
- **Stati:** step entra 250ms / esce 200ms (`popLayout`, niente salti di layout); pop una volta al mount in 400ms; highlight `data-highlight="on"` finché tap/click/focus lo spegne (`"off"`).
- **Token:** `--motion-*` / `--ease-*` da `app/globals.css` via `lib/motion/tokens.ts` (mai numeri nei componenti); `--success` per l'esito, `--accent` per l'highlight.
- **A11y:** `SuccessPop` è `role="status"`; con reduced motion (`useStableReducedMotion`, non solo media query) niente si muove e tutto resta in testo/colore/outline; la transizione non blocca mai l'input.
- Dettagli: pattern [patterns/onboarding.md](patterns/onboarding.md) (sezione implementazione), token [tokens.md](tokens.md#motion-per-onboarding), ADR [decisions/0003-motion-token.md](decisions/0003-motion-token.md).
