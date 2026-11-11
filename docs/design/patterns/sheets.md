# Pattern: sheet

Gli sheet sono pannelli scorrevoli dal basso. L’implementazione di riferimento è `components/ui/drawer.tsx`.

## Quando usarli

- Dettaglio di un elemento dalla mappa.
- Filtri o opzioni di ordinamento.
- Azioni contestuali rapide.
- Form brevi (max 3-4 campi).

## Quando NON usarli

- Flussi lunghi: usa una pagina intera.
- Messaggi di conferma: usa Toast o un inline banner.
- Menu con tante opzioni: usa una lista in pagina o una select nativa.

## Contenuto

1. **Handle** (44px tappabile).
2. **Titolo** opzionale (Syne `text-xl`).
3. **Body** con padding 20px orizzontale e 24px inferiore.
4. **Azione principale** in fondo quando serve.

## Chiusura

- Swipe down sul handle.
- Tap sul backdrop.
- Tasto `Escape`.
- Bottone esplicito “Chiudi” per casi accessibili.

## Accessibilità

- `role="dialog"`, `aria-modal="true"`.
- `aria-labelledby` collegato al titolo.
- Trappola del focus.
- Restore focus al chiusura.
- Body scroll bloccato.

## Esempio

```tsx
<Drawer open={open} onClose={() => setOpen(false)} title="Filtri">
  <div className="space-y-4">
    <Input placeholder="Cerca campo" />
    <Button className="w-full">Applica</Button>
  </div>
</Drawer>
```
