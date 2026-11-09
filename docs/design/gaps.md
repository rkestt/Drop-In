# Gaps — Eccezioni e buchi

Ogni riga è un debito esplicito: o si chiude (rimozione prevista) o resta documentato. Nuove eccezioni solo via ADR o aggiunta qui con owner.

| Data | File / punto | Motivo | Owner | Rimozione prevista |
|---|---|---|---|---|
| 2026-11-09 | ~~`components/ui/input.tsx` — `placeholder:text-[var(--text-muted)]`~~ CHIUSO | Placeholder con `--text-muted`: con `#949494` misura 5,43:1 su `--bg-surface` e 4,67:1 su `--bg-elevated`; passa AA per testo normale | @designer | — |
| 2026-11-09 | ~~`--text-muted` usato come testo corrente (es. stati vuoti, meta, `.mt-1`)~~ CHIUSO | `--text-muted` portato da `#7a7a7a` a `#949494`: 6,07:1 su base, 5,43:1 su surface, 4,67:1 su elevated. Ora è ammesso per testo normale, metadati e placeholder | @designer | — |
| 2026-11-09 | ~~Badge accent sotto AA~~ CHIUSO | `--accent` come testo su `--accent-subtle` stava a 4,48:1 su surface e 3,87:1 su elevated. La variante ora usa `--text-primary`: 11,38:1 su surface, 9,81:1 su elevated, tinta invariata | @designer | — |
| 2026-11-09 | ~~Controlli zoom MapLibre a 29px~~ CHIUSO | I controlli nativi sono 29x29px, sotto il minimo di 44px del progetto. Override in `globals.css` (`.maplibregl-ctrl-group button` 44x44), icona invariata | @designer | — |
| 2026-11-09 | ~~Attribuzione mappa illeggibile~~ CHIUSO | Il pacchetto non imposta il colore: il testo chiaro del tema finiva sul velo bianco al 50% dell'attribuzione. Ora `--bg-elevated` + `--text-secondary` (5,95:1), link inclusi | @designer | — |
| 2026-11-09 | Rapporti di contrasto (vedi `accessibility.md`) | ~~Nessun rapporto misurato~~ CHIUSO: coppie token misurate con formula WCAG e tabulate in `tokens.md` (es. accent-foreground/accent 6,37:1, danger-foreground/danger 6,04:1). Resta la verifica di pagina con axe, tracciata nella riga sotto | @designer | — |
| 2026-11-09 | Home `/` — 18 error axe `color-contrast` + 3 warn (skill design-review, dev server locale, viewport 360x780 / 768x1024 / 1280x800) | Non ancora rimisurato dopo il passaggio al tema dark. Le cause note sono state corrette: label 10px → 11px con `text-label`, `--text-muted` ora AA (4,67:1 nel caso peggiore). Manca solo la riesecuzione di axe per confermare 0 error | @tester | Dopo il redesign del tema/token, design-review deve tornare 0 error |
| 2026-11-09 | `app/layout.tsx` — meta viewport con `user-scalable=no` | ~~Zoom disabilitato~~ CHIUSO: `userScalable: true`, `maximumScale: 5`. Verificare con @tester su device | @designer | — |
| 2026-11-09 | Tema light — testi in `--accent` sotto AA | ~~Accent come testo su fondo chiaro~~ CHIUSO: con il tema dark `--accent` misura 6,37:1 su base, 5,70:1 su surface, 4,90:1 su elevated e 5,07:1 su `--accent-subtle` sopra base. Sopra surface ed elevated il testo accent sul subtle scende sotto AA: i badge accent usano `--text-primary` (riga dedicata sopra) | @designer | — |
| 2026-11-09 | Radius — classi legacy `rounded-lg` / `rounded-xl` / `rounded-full` in schermate non toccate | Stessi pixel dei token (`control-sm` 8px = `rounded-lg`, `card` 12px = `rounded-xl`, `chip` 9999 = `rounded-full`), quindi nessun drift visivo. La migrazione a `rounded-control-sm` / `rounded-card` / `rounded-chip` è completa su `components/ui`, styleguide e file toccati; altrove restano forme equivalenti | @designer | Migrazione meccanica, nessuna urgenza: sostituire quando si tocca il file |
| 2026-11-09 | ~~`tokens.md` — `--accent-foreground`, `--border`, `--border-strong`, `--overlay`, `--focus-ring`~~ CHIUSO | Token aggiunti in `:root` e `@theme inline`; codice migrato (`text-white`→`accent/danger-foreground`, `bg-black/30`→`overlay`) | @designer | — |
| 2026-11-09 | ~~Radius non tokenizzati `rounded-[10px]`, `rounded-t-[20px]`~~ CHIUSO | Token `--radius-control`, `--radius-sheet` (+ `-sm`, `-card`, `-chip`) in `@theme`; Button/Input/BottomSheet e le schermate toccate usano le utility | @designer | — |
| 2026-11-09 | ~~`docs/design/components/*.md` — classi corte~~ CHIUSO | Doc allineate alla convenzione reale `bg-[var(--…)]` | @designer | — |

| 2026-11-09 | `text-[13px]` (5 punti) | Fuori scala: nessun token equivalente tra label 11 e xs 12 / sm 14. Il check-design lo permette via allowlist | @designer | Mappare a 12 o 14 al prossimo ridisegno della schermata |
| 2026-11-09 | `text-[64px]` (2 punti) | Numero hero fuori scala (display-lg 40). Il check-design lo permette via allowlist | @designer | Valutare `text-display-lg` con `clamp()` quando si ridisegna |
| 2026-11-09 | `rounded-[1px]` (1 punto) | Barra di progresso da 1px, non un raggio di componente. Il check-design lo permette via allowlist | @designer | — |
| 2026-11-09 | `rounded-[inherit]` in `components/motion/next-highlight.tsx` | Non è un raggio: il velo del ring eredita il raggio tokenizzato del figlio (Badge, card…). Il check-design lo permette via allowlist | d7 | — |

## Template per nuove righe

```md
| AAAA-MM-GG | file o token | perché è un'eccezione | @owner | cosa la chiude |
```
