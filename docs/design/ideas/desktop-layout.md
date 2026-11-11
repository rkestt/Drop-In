# Idea desktop — mappa a "quadrato" con chrome intorno

**Stato: idea, non pianificata.** Non è un ticket e non si implementa adesso.
Serve a non perdere l'ipotesi e a ricordare perché è stata rimandata.

## L'idea (Andrea, 2026-11-12)

> Un quadratone in alto a sinistra con solo la mappa, con spazio in basso e a
> destra; a destra una bella nav per le lobby; in basso le cose utente/amici.

Layout desktop immaginato:

```
┌───────────────────────────────┬──────────────────────────┐
│                               │  Lobby                   │
│                               │  ┌────────────────────┐  │
│          MAPPA                │  │ vicino a te        │  │
│        (quadrato)             │  │ le tue             │  │
│                               │  │ crea               │  │
│                               │  └────────────────────┘  │
├───────────────────────────────┤                          │
│  Utente · amici · notifiche   │                          │
└───────────────────────────────┴──────────────────────────┘
```

## Perché ha senso

- Oggi il desktop è un telefono allargato: mappa ~420px e lista sotto a tutta
  larghezza. L'idea riconosce che **desktop ≠ mobile**: la mappa diventa un
  pannello tra altri, non "la pagina".
- La colonna a destra è il posto naturale per le lobby (contenuto verticale,
  lista lunga) e per il futuro "amici".
- La barra in basso per utente/amici libera la mappa dalla bottom nav e
  somiglia alle app social che Andrea ha in mente, non a un sito.

## Rischi da valutare in un prototipo

- **La mappa come quadrato fisso** spreca l'area migliore dello schermo: se il
  contenitore è `aspect-square` in alto a sinistra, sotto resta una fascia
  larga e vuota e a destra si perde l'altezza. La variante che ottiene la stessa
  sensazione senza sprechi: **mappa elastica** (`flex-1`, non quadrata) con rail
  destro fisso e barra bassa.
- Interazione: pan/zoom in un riquadro piccolo stanca; servono controlli
  (zoom, "vicino a me", filtri) sempre visibili.
- Marker e hover: su desktop ci si aspetta il preview della card passando il
  mouse; oggi non esiste.
- Le feature social (amici, inviti, DM) **non esistono**: disegnare il loro
  spazio adesso significa progettare intorno al nulla. Meglio farlo quando la
  prima feature social ha una spec.
- Le baseline visive a 1280 vanno rigenerate: previsto, ma da fare in un ticket
  dedicato con review.

## Quando riprenderla

Il momento giusto è quando atterra **la prima feature social reale** (amici,
inviti, o lobby con presenze). Prima è design speculativo; dopo, il layout
desktop diventa un vincolo che rallenta quella feature.

## Variante consigliata, se si parte

Mappa elastica (non quadrata) + rail destro 380–400px per lobby + barra bassa
per utente/amici, header desktop con logo/sport/ricerca/profilo. Mobile
invariato. Prototipo statico in `docs/design/prototypes/desktop.html` prima di
qualsiasi riga di codice.
