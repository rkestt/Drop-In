# 0004 — Tema unico dark

> **Status: Accepted.** Data: 2026-11-09.

## Stato

Accepted

## Contesto

Il tema chiaro di [ADR 0001](0001-tema-unico.md) non raggiungeva il contrasto AA: 18 errori axe sulla home, con `--text-muted` a 4.29:1 sul fondo chiaro. Il proprietario chiedeva chrome scuro, accento arancione/verde e mappa chiara. La ricerca 2026 raccomanda un solo tema con token semantici e nessun toggle.

## Decisione

- Tema unico dark. Nessun `data-theme`, nessun toggle, nessuna variante Tailwind `dark:`.
- Token in `:root` (`app/globals.css`):
  - `--bg-base: #141414`
  - `--bg-surface: #1f1f1f`
  - `--bg-elevated: #2b2b2b`
  - `--text-primary: #f0f0f0`
  - `--text-secondary: #a8a8a8`
  - `--text-muted: #949494` (solo icone/decorazioni, mai testo normale)
  - `--accent: #24ae56`
  - `--accent-hover: #2fc463`
  - `--accent-foreground: #141414`
  - `--success: #2dd4bf`
  - `--danger: #ff5a5f`
  - `--danger-foreground: #141414`
  - `--warning: #ffb020`
  - `--border: #333333`
  - `--border-strong: #4a4a4a`
  - `--overlay: rgba(0, 0, 0, 0.6)`
  - `--focus-ring: var(--accent)`
- Mappa sempre light ([ADR 0002](0002-mappa-light.md) resta valida): chrome scuro + mappa chiara.

## Motivazione

- Contrasto AA su tutte le superfici scure con testo chiaro.
- Leggibilità outdoor: chrome scuro incornicia la mappa chiara senza abbagliare.
- Un solo tema = meno debito: una palette, una mappatura semantica, nessun ramo `dark:`.
- Accent verde distinto dal success teal: il verde segnala l'azione primaria, il teal solo gli stati di successo.

## Conseguenze

- Testo su accent sempre scuro (`--accent-foreground`).
- Badge accent in tinta + bordo, non pieno.
- `text-muted` alzato a `#949494`; `--text-muted` vietato per testo normale.
- Controlli zoom MapLibre a 44px per il target touch.
- Viewport zoom riabilitato (niente `maximum-scale=1` / `user-scalable=no`).
- Motion invariato ([ADR 0003](0003-motion-token.md)).

## Alternative scartate

- Tema chiaro: bocciato per contrasto insufficiente (18 errori axe, muted 4.29:1).
- Doppio tema con toggle: bocciato, raddoppia palette, test e rami `dark:`.
- Accent blu GitHub: bocciato, meno distintivo su mappa chiara e in conflitto con link/overlay.

## Collegamenti

- [0001-tema-unico](0001-tema-unico.md) (superseded da questo ADR)
- [0002-mappa-light](0002-mappa-light.md)
- [0003-motion-token](0003-motion-token.md)
- [themes.md](../themes.md)
- [tokens.md](../tokens.md)

## Nota

Il valore dell'accent è stato scelto dopo confronto visivo: palette C, nero olio + verde V3 `#24ae56` (6.37:1 su base).
