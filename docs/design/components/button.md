# Button

File sorgente: `components/ui/button.tsx`.

## Anatomia

```tsx
<button
  className="inline-flex items-center justify-center font-semibold transition-all duration-150
             active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none
             focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
>
```

## Varianti

| Variante | Aspetto | Uso |
|---|---|---|
| `primary` | `bg-[var(--accent)]`, testo `text-[var(--accent-foreground)]`, hover `bg-[var(--accent-hover)]` | Azione principale: “Unisciti”, “Crea lobby”, CTA |
| `secondary` | `bg-[var(--bg-surface)]`, bordo `[var(--cool-muted)]`, testo `[var(--text-primary)]` | Azione secondaria su sfondo base |
| `ghost` | trasparente, testo `[var(--accent)]`, hover `bg-[var(--accent-subtle)]` | Azioni leggere in spazi stretti |
| `danger` | `bg-[var(--danger)]`, testo `text-[var(--danger-foreground)]`, hover opacity 90 | Elimina, abbandona, azioni distruttive |

## Size

| Size | Classi | Altezza | Uso |
|---|---|---|---|
| `default` | `px-6 py-3.5 rounded-control text-base` | ~56px | CTA principali, form |
| `sm` | `px-4 py-2.5 rounded-control-sm text-sm min-h-[44px]` | 44px | Inline, card, liste |
| `icon` | `h-12 w-12 rounded-card` | 48px | Icona sola (raro) |

## Stati

| Stato | Comportamento |
|---|---|
| Default | Variante di riferimento. |
| Hover | Primary → `bg-[var(--accent-hover)]`; secondary/ghost → cambio sfondo; danger → opacity 90. |
| Active | `active:scale-[0.97]` su tutte le varianti. |
| Focus | Anello accent 2px con offset 2px. |
| Disabled | `opacity-50`, `pointer-events-none`, `cursor-not-allowed`. |
| Loading | Non implementato. Usare `disabled` + spinner esterno fino a nuova variante. |
| Error | Non è uno stato del button. Usare variante `danger` per azioni distruttive. |

## Token usati

`--accent`, `--accent-hover`, `--accent-foreground`, `--bg-surface`, `--text-primary`, `--cool-muted`, `--danger`, `--danger-foreground`. Radius: `--radius-control`, `--radius-control-sm`, `--radius-card`.

## Quando usarlo

- CTA principale in card, form, bottom sheet.
- Azioni inline in liste (size `sm`).

## Quando NON usarlo

- Per link di navigazione: usa `Link` di Next.js con stile ghost se serve.
- Per icone flottanti in mappa: usa il FAB documentato in [nav.md](nav.md).
