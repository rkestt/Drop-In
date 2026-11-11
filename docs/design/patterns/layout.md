# Pattern: layout

## Shell mobile

L’app è pensata come contenitore mobile centrato su viewport più larghe.

```tsx
<body className="min-h-full flex flex-col bg-base text-primary">
  <div className="flex flex-col min-h-full">
    {children}
    <nav className="sticky bottom-0 ...">...</nav>
  </div>
</body>
```

- `min-h-full` e `flex flex-col` garantiscono che il footer nav resti in fondo anche con pochi contenuti.
- Non usare `100vh`: usa `dvh` dove serve (`min-h-[50dvh]` per la mappa).

## Max-width 720px

Tutti i contenuti principali sono limitati a 720px e centrati:

- Bottom nav: `max-w-[720px] mx-auto`.
- Bottom sheet: `max-w-[720px] mx-auto`.
- Header e liste: stesso limite su desktop.

Su schermi più stretti il contenuto occupa tutta la larghezza.

## Mappa band

La home è divisa in due bande:

1. **Mappa**: `flex-1 relative min-h-[50dvh]`.
2. **Contenuto sottostante**: `bg-base border-t border-cool-muted/20 p-4`.

Gli elementi sovrapposti alla mappa usano `absolute` con `z-20`/`z-30`:

- Sport selector in alto a sinistra.
- Banner “nessun campo” in basso al centro.
- FAB in basso a destra.

## Safe area

- `viewport-fit: cover` in `app/layout.tsx`.
- Classi custom `pb-safe` e `pt-safe` per aggiungere `env(safe-area-inset-*)`.
- La bottom nav applica `pb-safe` per non coprire i controlli del dispositivo.

## Spaziatura verticale

- `p-4` (16px) come padding standard sotto la mappa.
- `space-y-4` per sezioni.
- `space-y-3` per liste di card.

## Esempio

```tsx
<main className="flex-1 flex flex-col relative">
  <div className="flex-1 relative min-h-[50dvh]">
    <CourtMap />
    {/* elementi sovrapposti */}
  </div>
  <div className="bg-base border-t border-cool-muted/20 p-4 space-y-4">
    {/* liste e azioni */}
  </div>
</main>
```
