# Pattern: stati

## Loading

### Spinner inline

Usato per caricamenti brevi:

```tsx
<div className="animate-pulse space-y-3">
  <div className="h-8 w-32 bg-surface rounded-lg" />
  <div className="h-4 w-48 bg-surface rounded-lg" />
</div>
<span className="sr-only">Caricamento campi e lobby...</span>
```

### Skeleton

Per blocchi di contenuto:

```tsx
<div className="animate-shimmer h-4 bg-surface rounded-lg" />
```

`animate-shimmer` è già definito in `globals.css`.

### Mappa

Usare `MapSkeleton` mentre `CourtMap` viene caricato via `dynamic`.

## Empty

```tsx
<div className="text-center py-8">
  <MapPin className="w-8 h-8 text-muted mx-auto mb-2" />
  <p className="text-muted text-sm">Nessuna lobby attiva nelle vicinanze.</p>
  <p className="text-muted text-xs mt-1">Sii il primo a creare una!</p>
</div>
```

- Icona `text-muted` 32px.
- Titolo/messaggio `text-muted`.
- CTA opzionale sotto il messaggio.

## Error

```tsx
<div className="bg-surface rounded-xl p-4">
  <p className="text-danger text-sm">Posizione non disponibile</p>
  <Button variant="secondary" size="sm" className="mt-3">Riprova</Button>
</div>
```

- Testo `text-danger`.
- Azione di recovery visibile e vicina al messaggio.

## Disabled

Elementi disabilitati usano:

```css
opacity: 0.5;
pointer-events: none;
cursor: not-allowed;
```

Button lo implementa nativamente. Per altri elementi, replica le stesse classi.

## Skeleton vs spinner

- Meno di ~300ms: niente indicatore.
- 300ms–1s: spinner o pulsazione.
- Più di 1s: skeleton strutturale.
