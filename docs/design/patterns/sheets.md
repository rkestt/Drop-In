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

## Sheet non modale (foglio "Partite vicine" della home)

Il foglio della home (#89, `specs/home-ricerca.md`) **non è** il drawer qui sopra e non
usa `Drawer`: è un pannello ancorato che convive con la mappa.

| | Drawer (questo pattern) | Foglio della home |
|---|---|---|
| Semantica | `role="dialog"` + `aria-modal="true"` | `role="region"` + `aria-labelledby` |
| Backdrop | sì (`--overlay`) | no: la mappa sopra resta visibile e cliccabile |
| Focus | trap + restore al trigger | nessun trap, nessuno scroll lock |
| Chiusura | backdrop, Esc, «Chiudi» | altezza (handle/drag); in ricerca, × nel campo o Esc |
| Altezze | una, fino al bordo | misurate a runtime: striscia e piena |

Regola: se il pannello deve poter restare aperto **mentre si usa ciò che sta dietro**,
non è un drawer — è un foglio non modale, e va specificato a parte.

