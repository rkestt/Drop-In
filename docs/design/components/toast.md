# Toast

Un solo punto per gli esiti non bloccanti: [Sonner](https://sonner.emilkowal.ski/) montato una volta nel root layout. Sostituisce il toast fatto in casa (rimosso in d6: niente più array di toast, timer o markup dedicato).

## Anatomia

Un solo mount in tutta l'app, nel root layout (`app/layout.tsx`):

```tsx
<Toaster />
<KarmaListener />
```

La configurazione è hardcoded nel wrapper `components/notifications/toaster.tsx` — non sono props accettate dal componente, non passarne altre dai chiamanti:

- `theme="dark"`, `position="top-center"`, `closeButton`, `richColors={false}`, `expand={false}`, `visibleToasts={1}`;
- `offset` / `mobileOffset = calc(env(safe-area-inset-top, 0px) + 16px)`;
- `toastOptions.classNames` dai token (il resto dello stile arriva dagli override in `app/globals.css`).

Qualunque altro punto dell'app genera esiti con `toast.success` / `toast.warning` / `toast.error` di Sonner. Mai montare un secondo `<Toaster />` (la styleguide usa solo `toast`).

## Varianti

| Tipo | Quando | Esempio |
|---|---|---|
| `toast.success` | Esito positivo non bloccante, karma recuperato | "Campo aggiunto", "Karma +2 (92)" |
| `toast.warning` | Calo karma | "Hai perso 3 punti Karma (87)" |
| `toast.error` | Ban applicato | "Sei stato bannato fino al …" |

Errore di campo nei form → inline nel campo, mai toast. Mai `alert()`.

## Stati

| Stato | Aspetto |
|---|---|
| Default | `bg-elevated`, testo primary, bordo `border`, radius 12px (`rounded-card`), font Source Sans. |
| Descrizione | Testo secondary: spiega cosa è cambiato e cosa fare. |
| Singolo | `visibleToasts={1}`, `expand={false}`: un solo toast alla volta. |
| Dismiss | Pulsante chiudi, swipe verso l'alto, timeout Sonner. |
| Priorità | Con un solo toast visibile l'ultimo sostituisce il precedente: gli eventi escono in ordine crescente di severità (prima karma, poi ban) così il ban resta visibile. |

## Misure

- Distanza dal top: 16px + `env(safe-area-inset-top)` (fuori dalla notch, sopra la bottom nav che sta in basso).
- Posizione `top-center`: centrato orizzontalmente.
- Reduced motion: nessuna animazione di ingresso (regola globale in `app/globals.css` + media query di Sonner); il testo resta leggibile.

## Token usati

`--bg-elevated`, `--text-primary`, `--text-secondary`, `--border`, `--radius-card`, `--font-source-sans`. Override dei default Sonner (`--normal-bg`, `--normal-text`, `--normal-border`) in `app/globals.css`. Nessun colore hardcoded.

## Quando usarlo

- Successi e azioni non bloccanti (campo aggiunto, check-in confermato).
- Eventi realtime di karma/ban via `KarmaListener` (`components/notifications/karma-listener.tsx`): stessa subscription Realtime su `profiles` del vecchio toast, ma chiama solo `toast` con `id` stabile (`karma-${newKarma}`, `ban-${...}`) così un payload duplicato sostituisce invece di accodare. Non apre canali se l'utente non è loggato, non renderizza markup.

## Quando NON usarlo

- Errori di campo nei form: restano inline.
- Contenuto bloccante o che richiede scelta: usa un dialog/bottom sheet.
- Permessi push: `components/notifications/push-provider.tsx`, flusso separato.

## Dismiss su touch

Il `closeButton` di Sonner è ~20px: sotto il target minimo di 44px. Non si ingrandisce via props/classi senza rompere lo stile della libreria, quindi su touch il dismiss primario è lo **swipe verso l'alto** (gesto nativo di Sonner); il pulsante resta un affordance supplementare per puntatore e l'auto-dismiss chiude comunque dopo il timeout.
