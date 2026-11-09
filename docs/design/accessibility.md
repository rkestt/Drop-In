# Accessibilità

## Obiettivo

WCAG 2.2 livello AA per contrasto, focus, touch target e riduzione del movimento.

## Contrasto

Rapporti misurati con la formula WCAG 2.x (sRGB, luminanza relativa) sui token del tema dark. Fonte: `tokens.md`, sezione "Contrasti misurati".

| Testo | Sfondo | Rapporto | Requisito |
|---|---|---|---|
| `--text-primary` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 16,17 / 14,46 / 12,42:1 | ≥ 4.5:1 (testo normale) |
| `--text-secondary` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 7,75 / 6,93 / 5,95:1 | ≥ 4.5:1 (testo normale) |
| `--text-muted` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 6,07 / 5,43 / 4,67:1 | passa AA per testo normale |
| `--accent-foreground` | `--accent` | 6,37:1 | passa AA per testo normale |
| `--danger-foreground` | `--danger` | 6,04:1 | passa AA per testo normale |
| `--danger-dark` | `--danger`/20 su elevated | 6,41:1 | passa AA per testo normale |

Regole:

- Testo normale (<18px o <14px bold): contrasto minimo 4.5:1.
- Testo grande (≥18px o ≥14px bold): contrasto minimo 3:1.
- `--text-muted` passa AA come testo normale (4,67:1 nel caso peggiore, su `--bg-elevated`): è ammesso per placeholder, metadati e icone. (Il placeholder di `components/ui/input.tsx` sta a 5,43:1 su `--bg-surface`.)

## Focus visibile

- Anello: `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2`.
- Applicato a button, input, link interattivi, select.
- Non rimuovere mai `outline` senza sostituirlo con un anello visibile.

## Touch target

- WCAG 2.2 (SC 2.5.8) richiede minimo **24x24 CSS px** per ogni target. Il progetto adotta **44px** come scelta più severa: resta il minimo vincolante.
- Minimo 44x44px per ogni elemento tappabile.
- Controlli mappa (zoom MapLibre): 44x44px, override in `globals.css` sul default 29px del pacchetto.
- Attribuzione mappa: superficie `--bg-elevated`, testo `--text-secondary` (5,95:1), link inclusi.
- Bottom nav link: 48px di altezza.
- FAB: 56px.
- Handle sheet: 44px.

## Riduzione del movimento

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Già presente in `globals.css`. Verificare che ogni nuova animazione rispetti questa media query.

## Aria e struttura

- `html lang="it"` già impostato.
- `aria-label` su FAB e icone actionable.
- `aria-hidden="true"` sulle icone decorative.
- `aria-live="polite"` per annunci dinamici (campi visibili, lobby disponibili).
- Bottom sheet: `role="dialog"`, `aria-modal="true"`, trappola focus.
- Form: label associate agli input (`htmlFor`/`id`).

## Test da fare

1. Navigazione tastiera su tutti gli elementi interattivi.
2. VoiceOver/TalkBack su FAB, bottom sheet, liste.
3. Verifica contrasto con DevTools o APCA.
4. Attivare `prefers-reduced-motion` e verificare che nulla tremi o lampeggi.
