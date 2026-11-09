---
id: d15
type: design
hitl: true
claimed: false
blocked_by: []
---
## Question

**Obiettivo.** Prototipare la segnalazione di un campo: categorie reali, descrizione breve, esito con scadenza. Deve essere chiaro che non è una recensione e che la segnalazione scade.

**File coinvolti.** `docs/design/prototypes/report.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Categorie (vincolanti, dal check DB di `court_reports`).**

`broken_hoop` → "Canestro rotto"; `wet_court` → "Campo bagnato"; `lighting` → "Illuminazione"; `occupied` → "Occupato"; `other` → "Altro".

**Frame da includere (toolbar).**

1. **Drawer vuoto**: nome campo, chip categorie (una sola selezionabile), textarea "Dettagli (facoltativo)" con contatore `0/280`, CTA primaria "Invia segnalazione", secondaria "Annulla".
2. **Categoria selezionata** + testo: stessa schermata, CTA attiva.
3. **Errore validazione**: nessuna categoria → "Scegli cosa non va" inline + `aria-invalid`; testo oltre 280 → errore sotto la textarea.
4. **Loading**: CTA disabilitata, "Invio…", `aria-busy`.
5. **Successo**: "Segnalazione inviata. Resta attiva fino al 16 nov, 19:40." + "Chiudi"; nessuna pagina "Grazie".
6. **Già segnalato**: il campo mostra le segnalazioni attive con categoria e scadenza; CTA sostituita da "Hai già segnalato questo campo" + "Chiudi". Non un secondo invio.
7. **Errore rete**: "Non siamo riusciti a inviare la segnalazione." + "Riprova"; categoria e testo conservati.

**Regole di design.**

- Il drawer si apre dal dettaglio campo; il pulsante si chiama "Segnala", non "Aggiungi".
- Una sola CTA primaria; le categorie sono chip, non radio nascosti.
- La scadenza è visibile nel successo e nello stato "già segnalato": è il motivo per cui la segnalazione non è permanente.
- Niente foto: non c'è storage per le segnalazioni in questo piano.
- Il testo è facoltativo; la categoria è obbligatoria.
- Copy concreto: "Canestro rotto", non "Struttura danneggiata".

**Accessibilità.**

- Chip come radiogroup (`role="radio"` / `aria-checked`) o bottoni `aria-pressed`; una sola scelta.
- Errore collegato con `aria-describedby`; focus sul primo errore al submit.
- Contatore testo annunciato con moderazione (non `aria-live` a ogni tasto).
- Drawer con focus trap, `Esc`, backdrop, restore focus.

**Acceptance.**

- Il file apre a 360px e 768px; i 7 stati si cambiano dalla toolbar.
- Le 5 categorie corrispondono esattamente ai valori del DB.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `report.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/report.html /tmp/opencode/report-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/report.html
```

**Riferimenti.** `components/report/report-sheet.tsx`, `supabase/migrations/001_initial_schema.sql` (`court_reports`), `docs/design/content.md`.

## Resolution

(TBD — esito review, copy categorie, stato "già segnalato", screenshot.)
