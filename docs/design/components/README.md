# Componenti UI

I componenti riutilizzabili vivono in `components/ui/`. Sono atomici: nessuna logica di business, solo presentazione.

## Componenti disponibili

- [Button](button.md)
- [Input](input.md)
- [Badge](badge.md)
- [Bottom Sheet](bottom-sheet.md)

## Componenti non atomici ma documentati

- [Card](card.md): pattern ricorrente, non esiste come componente standalone.
- [Navigazione + FAB](nav.md): bottom nav e floating action button della home.

## Regole

- Non duplicare classi dai componenti UI: importa e componi.
- Non introdurre nuove varianti senza aggiornare questo README e il file dedicato.
- Non usare colori hardcoded: usa i token di `app/globals.css`.
- Ogni componente interattivo deve avere almeno: default, hover, active, focus, disabled.
- Touch target minimo 44px.
