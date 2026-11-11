# Input

File sorgente: `components/ui/input.tsx`.

## Anatomia

```tsx
<input
  className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control
             px-4 py-3.5 text-base border border-transparent transition-colors
             placeholder:text-[var(--text-muted)]
             focus:outline-none focus:border-[var(--accent)]
             focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
/>
```

## Varianti

Il componente ha una sola variante. Lo stato di errore si ottiene aggiungendo classi dal chiamante:

```tsx
<Input className="border-[var(--danger)] text-[var(--danger)] placeholder:text-[var(--danger)]/60" />
```

## Stati

| Stato | Aspetto |
|---|---|
| Default | Sfondo `bg-[var(--bg-surface)]`, bordo trasparente, placeholder `text-[var(--text-muted)]`. |
| Focus | Bordo `[var(--accent)]`, anello focus accent con offset. |
| Filled | Testo `text-[var(--text-primary)]`. |
| Disabled | Eredita stile disabilitato del browser; opzionalmente aggiungere `opacity-50`. |
| Error | Bordo e testo `[var(--danger)]` (da applicare esternamente). |

## Misure

- Altezza minima: 44px (raggiunta con `py-3.5` + line-height 16px).
- Padding orizzontale: 16px.
- Radius: 10px (`rounded-control` = `--radius-control`).
- Font: 16px (evita lo zoom su iOS).

## Token usati

`--bg-surface`, `--text-primary`, `--text-muted`, `--accent`, `--danger` (per errore esterno), `--radius-control`.

## Quando usarlo

- Ricerca campi (`CourtSearch`).
- Form di creazione lobby / segnalazione campo.

## Quando NON usarlo

- Per selezione sport: usa `SportSelector`.
- Per grandi blocchi di testo: serve `textarea` (non ancora in UI kit; chiedi a @designer).
