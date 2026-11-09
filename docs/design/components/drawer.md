# Drawer

File sorgente: `components/ui/drawer.tsx` (wrapper del progetto su `Drawer` di Base UI, unica primitiva per dialog/drawer).

## Anatomia (API pubblica del wrapper)

```tsx
<Drawer open={open} onClose={() => setOpen(false)} title="Crea lobby">
  <div className="space-y-4">
    <Input placeholder="Cerca campo" />
    <Button className="w-full">Applica</Button>
  </div>
</Drawer>
```

Il wrapper accetta solo `open`, `onClose`, `title?`, `description?`, `children`,
`className?`. Dentro rende le parti Base UI (`Drawer.Root` controllato con `modal`
e `swipeDirection="down"` → `Portal` → `Backdrop` + `Viewport` → `Popup` con handle
visivo 44px, `Drawer.Title`/`Drawer.Description`, body `px-5 pb-6`). Per i dettagli
interni vedi `components/ui/drawer.tsx`.

## API del wrapper

```tsx
<Drawer open={open} onClose={() => setOpen(false)} title="Crea lobby">
  …
</Drawer>
```

- Props: `open`, `onClose`, `title?`, `description?`, `children`, `className?` (unito al Popup con `cn()`).
- Nessuna animazione custom: transizioni di Base UI; `prefers-reduced-motion` già globale in `globals.css`.

## Comportamento (da Base UI, `modal`)

- Focus trap: Tab cicla dentro il drawer, Shift+Tab torna all'ultimo.
- `initialFocus`: primo elemento tabbabile; `finalFocus`: trigger o elemento precedente.
- Chiude con swipe verso il basso, tasto `Escape`, tap sul backdrop.
- Blocca lo scroll del body.
- Al chiusura restituisce il focus all’elemento che ha aperto lo sheet.

### Nota su `outline-none` e focus visibile

Il Popup ha `outline-none`: serve al caso "drawer senza focusabili", dove
`initialFocus` ripiega sul contenitore e un anello attorno a tutto lo sheet
sarebbe rumore. Il focus visibile dei controlli interni resta garantito dai
loro stili `focus-visible` (bottoni, input): ogni drawer deve quindi contenere
almeno un controllo azionabile o un bottone esplicito di chiusura, mai solo
testo. Nessun hack aggiunto: se un drawer nasce senza focusabili, la soluzione
è aggiungere il bottone, non togliere `outline-none`.

## Varianti

Unica. Il contenuto è libero ma deve rispettare i token e i componenti UI.

## Stati

| Stato | Aspetto |
|---|---|
| Closed | Non renderizzato. |
| Open | Drawer in posizione finale, backdrop opaco. |
| Swiping | Drawer traslato in base al dito; rilascio oltre soglia chiude. |

## Misure

- Larghezza massima: 720px, centrata.
- Radius superiore: 20px (`rounded-t-sheet` = `--radius-sheet`).
- Handle: 40x6px, touch target 44px (visivo, `aria-hidden`: la chiusura da tastiera passa da Escape e dai bottoni).
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
