# Navigazione + FAB

Sorgenti: `app/(app)/layout.tsx` (bottom nav), `app/(app)/page.tsx` (FAB).

## Bottom Navigation

### Anatomia

```tsx
<nav className="sticky bottom-0 bg-[var(--bg-elevated)] border-t border-[var(--cool-muted)]/20 pb-safe">
  <div className="max-w-[720px] mx-auto flex items-center justify-around h-14">
    <Link className="flex flex-col items-center justify-center w-16 h-14 min-h-[48px] text-[var(--accent)]">
      <Icon className="w-6 h-6" />
      <span className="text-label font-medium mt-0.5">Mappa</span>
    </Link>
  </div>
</nav>
```

### Stati

| Stato | Aspetto |
|---|---|
| Active | Icona e label `text-[var(--accent)]`. |
| Inactive | Icona e label `text-[var(--text-muted)]`. |
| Pressed | Ereditato dal browser; opzionalmente `active:opacity-80`. |
| Focus | Anello accent su `Link`. |

### Misure

- Altezza nav: 56px (`h-14`).
- Touch target link: 64x48px.
- Icona: 24px.
- Label: 11px (`text-label`).
- Max-width container: 720px.

## Floating Action Button (FAB)

### Anatomia

```tsx
<Link
  className="absolute bottom-4 right-4 z-30 inline-flex items-center justify-center
             w-14 h-14 rounded-chip bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg
             hover:bg-[var(--accent-hover)] active:scale-[0.97] transition-all
             focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
  aria-label="Aggiungi un campo"
>
  <Plus className="w-7 h-7" />
</Link>
```

### Stati

| Stato | Aspetto |
|---|---|
| Default | Cerchio 56px, bg `[var(--accent)]`, icona `[var(--accent-foreground)]`, shadow-lg. |
| Hover | `bg-[var(--accent-hover)]`. |
| Active | `active:scale-[0.97]`. |
| Focus | Anello accent. |

### Posizionamento

- Assoluto rispetto al contenitore della mappa.
- `bottom-4 right-4` (`16px`).
- `z-30` per stare sopra la mappa ma sotto agli sheet (`z-50`).

## Token usati

`--bg-elevated`, `--cool-muted`, `--accent`, `--accent-hover`, `--accent-foreground`, `--text-muted`, `--radius-chip`.

## Quando usarli

- Bottom nav per le sezioni principali dell’app (Mappa, Profilo).
- FAB per l’azione primaria contestuale della mappa (aggiungi campo).

## Quando NON usarli

- Non aggiungere più di 5 voci nella bottom nav.
- Non usare il FAB per azioni secondarie: mettile nel menu contestuale o nello sheet.
