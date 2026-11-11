# Card

Nota: non esiste un componente `Card` atomico in `components/ui/`. Le card sono pattern costruiti con i token. I due punti di riferimento sono `components/lobby/lobby-card.tsx` e la lista lobby in `app/(app)/page.tsx`.

## Anatomia

```tsx
<div className="bg-[var(--bg-surface)] rounded-card p-4 space-y-3">
  {/* header */}
  {/* body */}
  {/* action */}
</div>
```

Per elementi cliccabili in lista:

```tsx
<Link className="block bg-[var(--bg-surface)] rounded-card p-4 active:bg-[var(--bg-elevated)] transition-colors">
```

## Varianti

| Variante | Struttura | Esempio |
|---|---|---|
| List item | `block` con `active:bg-[var(--bg-elevated)]` | Elemento lista lobby in homepage |
| Lobby card | `bg-[var(--bg-surface)] rounded-card p-4 space-y-3` | `components/lobby/lobby-card.tsx` |

## Stati

| Stato | Aspetto |
|---|---|
| Default | `bg-[var(--bg-surface)]`, radius 12px, padding 16px. |
| Active/pressed | `active:bg-[var(--bg-elevated)]` per item cliccabili. |
| Focus | Se il container è focusable, anello accent. |
| Disabled | Non applicato direttamente; disabilita le azioni interne. |

## Misure

- Padding: 16px (`p-4`).
- Radius: 12px (`rounded-card` = `--radius-card`).
- Spazio interno tra blocchi: 12px (`space-y-3`).

## Token usati

`--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-subtle`, `--danger`.

## Quando usarla

- Raggruppare informazioni correlate (lobby, dettaglio campo).
- Liste scrollabili sotto la mappa.

## Quando NON usarla

- Per un solo dato isolato: usa testo o un badge.
- Per elementi che devono essere pienamente interattivi come bottoni: usa Button.
