# Bottom Sheet

File sorgente: `components/ui/bottom-sheet.tsx`.

## Anatomia

```tsx
<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end">
  <div className="absolute inset-0 bg-[var(--overlay)]" aria-hidden="true" />
  <div className="w-full max-w-[720px] mx-auto bg-[var(--bg-elevated)] rounded-t-sheet shadow-lg pb-safe">
    <div className="min-h-[44px] flex justify-center pt-3 pb-3 cursor-grab">
      <div className="w-10 h-1.5 rounded-full bg-[var(--text-muted)]/30" />
    </div>
    {title && <h2 className="font-syne text-xl ...">{title}</h2>}
    <div className="px-5 pb-6">{children}</div>
  </div>
</div>
```

## Comportamento

- Entra con `slideUp` 300ms, easing `cubic-bezier(0.25, 1, 0.5, 1)`.
- Chiude con swipe verso il basso (>80px) o con tasto `Escape`.
- Clic sul backdrop chiude.
- Blocca lo scroll del body.
- Trappola del focus: Tab cicla dentro lo sheet.
- Al chiusura restituisce il focus all’elemento che ha aperto lo sheet.

## Varianti

Unica. Il contenuto è libero ma deve rispettare i token e i componenti UI.

## Stati

| Stato | Aspetto |
|---|---|
| Closed | Non renderizzato. |
| Open | Sheet in posizione finale, backdrop opaco. |
| Dragging | Sheet traslato verticalmente in base al dito; cursore `grabbing`. |
| Exiting | Classe `.sheet-exit` anima `slideDown` 250ms. |

## Misure

- Larghezza massima: 720px, centrata.
- Radius superiore: 20px (`rounded-t-sheet` = `--radius-sheet`).
- Handle: 40x6px, touch target 44px.
- Padding contenuto: 20px orizzontale, 24px inferiore.

## Token usati

`--bg-elevated`, `--text-primary`, `--text-muted`, `--overlay`, `--radius-sheet`.

## Quando usarlo

- Dettagli campo.
- Filtri o azioni contestuali.
- Form brevi.

## Quando NON usarlo

- Per flussi lunghi: usa una pagina intera.
- Per messaggi di conferma semplici: usa Toast o un inline banner.
