# Check-in

Spec implementativa (d21) del prototipo approvato `docs/design/prototypes/checkin.html`.
Un passo, nessun mock in produzione, nessun successo ottimistico.

## Stati

| # | Stato | UI |
|---|-------|----|
| 1 | Idle | Nome campo, "Check-in aperto ora / resta attivo 2 ore", nota GPS 50 m, CTA "Fai check-in" + "Annulla" |
| 2 | Loading | "Verifica posizione…", bottone disabilitato, `aria-busy` |
| 3 | Permesso negato (`code === 1`) | Causa + "Come fare" (disclosure) + "Riprova" |
| 4 | Posizione / timeout (`code === 2 / 3`) | Messaggi distinti + "Riprova" |
| 5 | Accuratezza `> 20 m` | "Segnale GPS debole (±N m). Esci all'aperto e riprova." + "Riprova" |
| 6 | Fuori raggio | Messaggio del trigger DB ("Sei a N m…"), mai ricalcolato client; CTA "Aggiorna posizione" |
| 7 | Già dentro | "Sei qui dalle HH:MM, check-in attivo fino alle HH:MM" + check-out secondaria; nessun secondo check-in |
| 8 | Successo | `SuccessPop`, "Check-in attivo fino alle HH:MM", chiusura esplicita ("Chiudi", niente auto-close) |
| 9 | Server generico | Messaggio + "Riprova", dati conservati |

## Regole

- Validazione vera nel DB: trigger `enforce_check_in_distance` (50 m),
  cooldown 5 min, auto-checkout 2h (pg_cron). Il client non è la difesa.
- Scadenza = `checked_in_at + 2h`, formato `it-IT` HH:MM
  (`lib/checkin/errors.ts`: `expiryFromCheckin`, `formatExpiry`).
- Errori inline (`role="alert"`); toast Sonner solo per esiti non bloccanti
  (check-in/check-out riusciti). Successo inline via `SuccessPop`
  (`role="status"`), senza pop con reduced motion (testo invariato).
- Mock GPS solo se `NEXT_PUBLIC_ALLOW_MOCK_GPS === "true"` **e**
  `NODE_ENV !== "production"` — calcolato dal Server Component
  (`page.tsx`) e passato come prop `mockGps`, così il nome della variabile
  non compare mai nel bundle client (`grep ALLOW_MOCK_GPS .next/static`
  vuoto); la UI dichiara "Posizione simulata".
  Con mock disattivo nessun percorso usa `courtLat/courtLng` al posto del GPS.
- Bottone mai tappabile due volte (`disabled` durante la richiesta).

## File

- `components/check-in/check-in-sheet.tsx` — stati, `Drawer` + `StepTransition` + `SuccessPop` riusati.
- `components/check-in/check-in-button.tsx` — label "Sei qui" con check-in attivo, passa `activeCheckIn`.
- `components/check-in/checkout-button.tsx` — toast su esito, reload invariato.
- `app/(app)/courts/[id]/page.tsx` — query additiva del check-in `active` dell'utente.
- `lib/checkin/errors.ts` — mapper puro code/accuratezza/messaggio DB → testi + recovery.
- `tests/unit/checkin-errors.test.ts` — codici 1/2/3, accuratezza, distanza, cooldown, già dentro, scadenza.
