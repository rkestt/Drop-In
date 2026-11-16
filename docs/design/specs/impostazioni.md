# Impostazioni

Route: `/settings` (gruppo `(dashboard)` — header “Indietro”, nessuna bottom nav).
Prototipo: `docs/design/prototypes/settings.html` (approvato 2026-11-10, 8 stati).
Ticket: `.wayfinder/tickets/d18-impl-settings.md`.

## Obiettivo

Cambiare le sole preferenze che funzionano davvero: sport attivo, pallino
avvisi, permesso posizione, nickname/logout, e leggere versione e attribuzioni.

## Stati

- **Sport scelto.** Griglia di chip single-select con le stesse 8 opzioni del
  primo passo dell'onboarding (7 discipline + «Tutti»), nel riquadro della
  sezione. La scelta scrive subito (`sport`, «Tutti» = `all`): nessun «Salva»,
  nessun toast — il chip cambia stato e la mappa lo applica al ritorno.
- **Default (posizione da chiedere).** Badge “Da chiedere”, descrizione
  “Serve per la mappa, il check-in entro 50 m e le lobby vicine.”,
  CTA “Consenti posizione” + hint “Il telefono ti chiederà il permesso.”
- **Posizione consentita.** Badge “Consentita” (success), stessa descrizione,
  nota “Non salviamo le tue coordinate.” Nessuna CTA.
- **Posizione negata.** Badge “Negata” (danger), descrizione “Senza posizione
  non possiamo mostrarti i campi vicini né verificare il check-in.”, blocco
  “Come riattivarla” (Safari / Chrome) + “Riprova”.
- **Posizione non supportata.** Badge “Non supportata”, nota che il browser
  non supporta la geolocalizzazione; resto dell’app comunque usabile.
- **Controllo in corso.** Card in `aria-busy` con placeholder e sr-only
  “Controllo del permesso di posizione…”.
- **Pallino spento.** Switch `aria-checked="false"`, etichetta “Spento”.
- **Logout.** Drawer “Vuoi uscire?” (conferma) → sessione chiusa → `/`.
  Se `signOut` fallisce: errore inline con “Riprova”, nessun toast isolato.
- **Toast.** Sonner: “Pallino degli avvisi attivo/spento” al toggle.

## Copy

- Sport: “La mappa e le lobby vicine seguono questa scelta.” + chip
  “Basket · Calcio · Tennis · Padel · Calcio a 5 · Pallavolo · Polivalente ·
  Tutti” (“Tutti” = nessun filtro). Sezione dopo «Posizione», prima di
  «Account».
- Notifiche: “Avvisi nell’app” / “Le novità su campi, lobby e check-in.”;
  “Pallino degli avvisi non letti” / “Un punto sulla campanella quando c’è
  qualcosa di nuovo.”; push: “Notifiche push” / “Non disponibili in questa
  versione: richiedono l’invio dal server.” + nota “Per ora non chiediamo il
  permesso del telefono: non avremmo niente da inviarti.”
- Account: “Email” / “Sola lettura”; “Nickname” / “Modifica il nickname”;
  drawer: titolo “Vuoi uscire?”, corpo “Le tue lobby e il tuo karma restano
  salvati. Per ritrovarli, accedi di nuovo.”, azioni “Esci” / “Annulla”.
- Informazioni: “Versione” + `APP_VERSION`; “Dati mappa © OpenStreetMap
  contributors.” (link a `https://www.openstreetmap.org/copyright`);
  “Tile © OpenFreeMap. Stile © OpenMapTiles.”;
  “Font: Syne e Source Sans 3, licenza OFL.”

## A11y

- Switch `role="switch"` + `aria-checked` + label; stato anche testuale
  (“Attivo/Spento”), non solo colore.
- Sport: `role="radiogroup"` nominato dall'`h2` della sezione, opzioni
  `role="radio"` + `aria-checked`; una sola tab stop (roving tabindex), frecce
  che spostano selezione e fuoco in ciclo; stato non solo colore (spunta,
  bordo `--accent`, fondo `--accent-subtle`).
- Live region `role="status"` per toggle pallino e cambio permesso.
- Icone decorative `aria-hidden`; target ≥ 44px (righe 56px, bottoni `sm`).
- Focus visibile (ring); `motion-safe:` sulle transizioni dello switch.
- Mai `Notification.requestPermission()`.

## Screenshot

360px + 768px della route implementata (verifica live, console pulita).

## Note di scostamento (d18)

- “Avvisi nell’app” punta a `/notifications` (rotta d22, non ancora esistente:
  404 finché d22 non atterra).
- “Informativa privacy” e “Segnala un problema” omesse: il prototipo ne
  rimanda le destinazioni a d18 e non esiste alcuna destinazione reale
  (nessuna voce che non faccia nulla, da regola del ticket).
- Link “Impostazioni” in `profile/page.tsx` NON aggiunto: lane parallela sta
  riscrivendo quella pagina; da fare al merge.
