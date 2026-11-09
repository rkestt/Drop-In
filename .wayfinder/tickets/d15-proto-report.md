---
id: d15
type: design
hitl: true
claimed: true
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

**Stato: in review HITL.** Prototipo in `docs/design/prototypes/report.html`, creato senza toccare `proto.css`, `proto.js`, `app/` o `components/`. La riga `report.html` in `prototypes/README.md` resta «da fare» su indicazione dell'orchestratore: va aggiornata ad approvazione avvenuta.

**Stati (toolbar, 7).** Vuoto · Scelto · Errore · Invio · Inviato · Già segnalato · Errore rete. Il drawer si apre dal dettaglio campo con «Segnala»; backdrop, Esc, «Annulla», «Chiudi» e la barra lo chiudono con restore focus. «Invia» valida davvero: senza categoria mostra «Scegli cosa non va», porta il focus sul gruppo e, con dati validi, apre il frame «Inviato».

**Categorie (mappatura DB).** `broken_hoop` Canestro rotto · `wet_court` Campo bagnato · `lighting` Illuminazione · `occupied` Occupato · `other` Altro. I valori sono nei `data-value` delle chip; una sola `aria-pressed="true"` per gruppo.

**Copy definitivo.**

- Lead drawer: «Vale per le prossime 48 ore: non è una recensione del campo.»
- Successo: «Segnalazione inviata.» / «Resta attiva fino al 16 nov, 19:40.» / «Dopo quella data sparisce da sola: puoi segnalare di nuovo.»
- Già segnalato: «Hai già segnalato questo campo» / «Puoi inviarne un'altra quando la tua scade.»
- Rete: «Non siamo riusciti a inviare la segnalazione.» / «Categoria e dettagli sono ancora qui.» / «Riprova».

**Checklist `prototypes/README.md`.**

- [x] Pipeline, passo e prossimo passo nel commento in testa (F2 → d15 → review HITL → d23).
- [x] Tutti e 7 gli stati presenti e raggiungibili dalla toolbar.
- [x] Copy italiano, concreto, senza gergo.
- [x] Un solo controllo accent per schermata; target ≥ 44px verificati; focus visibile su chip, handle, bottoni, textarea.
- [x] Contrasto AA: solo token di `proto.css` (testo `--text-*`, superfici `--bg-*`, esiti `--success`/`--danger`, accent solo CTA).
- [x] Reduced motion: nessuna informazione affidata al movimento; lo spinner perde l'animazione e resta «Invio…» (verificato con `reducedMotion`).
- [x] Screenshot 360 e 768 (sotto).
- [x] Nessun colore fuori da `proto.css`, nessun font diverso da Syne/Source Sans 3.

**Verifica eseguita.**

- `grep -L 'proto.css'` e `grep -nE '#[0-9a-fA-F]{3,8}'`: output vuoto.
- Nessuno scroll orizzontale a 360 e 768 (`scrollWidth` pagina = viewport; `scrollWidth` del telefono = `clientWidth` in tutti gli stati).
- Pannello drawer sempre dentro il telefono (max 711px su 778 di sheet): nessuno scroll interno.
- 7 dialog, nessun id duplicato, `aria-labelledby`/`aria-describedby` risolti, tutti i bottoni visibili ≥ 44×44.
- `file://` apre senza errori console, con Syne e Source Sans 3 caricati; nessuna fetch, nessun import dall'app.
- Interazioni provate con Playwright: backdrop, Esc, focus trap, restore focus su «Segnala», errore categoria + focus, contatore e limite 280, salto al frame «Inviato».

**Screenshot.**

- `/tmp/opencode/report-360.png` e `/tmp/opencode/report-768.png` (comandi del ticket).
- `/tmp/opencode/report-360-full.png` e `/tmp/opencode/report-768-full.png`: pagina intera, drawer completo; sono quelli da guardare.
- `/tmp/opencode/report-{360,768}-report-*.png`: un'immagine per stato.

**Da decidere in review.**

1. **CTA a vuoto.** Tenuta attiva anche senza categoria: il frame «Errore» esiste solo se il submit è raggiungibile, e un bottone disabled non spiega cosa manca. Se si vuole il disabled nello stato vuoto, è una modifica di una riga.
2. **Frame rete.** Niente lead «48 ore» in quello stato: il banner d'errore prende il suo posto e il drawer resta dentro i 780px con il dettaglio campo ancora visibile. La scadenza resta nei frame 1–4 e 5–6.
3. **Già segnalato.** Mostra due segnalazioni attive (la propria con badge «Tua» + una di un altro utente) e sostituisce il form con il notice; nessun secondo invio. Il DB non ha un vincolo di unicità per utente/campo: la regola «una sola attiva» va imposta in d23 (check prima dell'insert).
4. **Date.** 16 nov 19:40 (propria) e 11 nov 08:15 (altra) sono dati di esempio coerenti col TTL di 48h; la copy della scadenza è quella del ticket.
5. **Font.** Syne e Source Sans 3 arrivano dal `proto.css` condiviso, che li incorpora come `data:`: nessun font remoto, nessuna fetch, e anche da `file://` il rendering è quello vero. Gli screenshot usano quei font.
6. **Chip.** Bottoni `aria-pressed` (alternativa ammessa dal ticket) con pallino di stato, così la selezione non è affidata al solo colore; il gruppo ha `role="group"`, il label «Cosa non va» e `tabindex="-1"` per il focus sull'errore.

**Prossimo passo.** Review HITL sulle scelte qui sopra; poi d23 implementa `components/report/**` con lo stesso copy e la scadenza calcolata a 48h.
