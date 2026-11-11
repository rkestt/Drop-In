# Badge

File sorgente: `components/ui/badge.tsx`.

## Anatomia

```tsx
<span
  className="inline-flex items-center px-2.5 py-1 rounded-chip text-xs font-medium
             uppercase tracking-wider"
>
```

## Varianti

| Variante | Aspetto | Uso |
|---|---|---|
| `default` | `bg-[var(--bg-surface)]`, testo `[var(--text-muted)]`, bordo `[var(--cool-muted)]/20` | Stato neutro o generico |
| `accent` | `bg-[var(--accent-subtle)]`, testo `[var(--text-primary)]`, bordo `[var(--accent)]/30` | Stato attivo, in evidenza |
| `success` | `bg-[var(--success)]/20`, testo `[var(--success-dark)]`, bordo `[var(--success)]/25` | Confermato, completato |
| `warning` | `bg-[var(--warning)]/20`, testo `[var(--warning-dark)]`, bordo `[var(--warning)]/25` | In corso, attenzione |
| `danger` | `bg-[var(--danger)]/20`, testo `[var(--danger-dark)]`, bordo `[var(--danger)]/25` | Bloccato, errore |

## Stati

Badge è un elemento statico. Non ha hover, active o disabled.

## Misure

- Padding: 10px orizzontale, 4px verticale.
- Font: 12px, maiuscolo, `tracking-wider`.
- Radius: chip, 9999px (`rounded-chip` = `--radius-chip`).

## Token usati

`--bg-surface`, `--text-primary`, `--text-muted`, `--cool-muted`, `--accent`, `--accent-subtle`, `--success`, `--success-dark`, `--warning`, `--warning-dark`, `--danger`, `--danger-dark`.

## Contrasto

- `default`: `--text-muted` su `--bg-surface` = 5,43:1.
- `accent`: `--text-primary` su `--accent-subtle` = 11,38:1 su surface, 9,81:1 su elevated. Con `--accent` come testo si fermava a 4,48:1 su surface e 3,87:1 su elevated, sotto AA.

## Quando usarlo

- Stato di una lobby (aperta, in corso, chiusa).
- Etichette di stato moderazione.

## Quando NON usarlo

- Come pulsante: i badge non sono cliccabili.
- Per numeri grandi o contatori: usa testo Syne.
