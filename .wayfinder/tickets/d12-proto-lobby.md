---
id: d12
type: design
hitl: true
claimed: true
blocked_by: []
---
## Question

**Obiettivo.** Prototipare l'intera area lobby: lista, creazione, dettaglio e join. Deve reggere piena, in corso, chiusa, bannato e karma basso senza diventare quattro flussi diversi.

**File coinvolti.** `docs/design/prototypes/lobby.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Frame da includere (toolbar).**

1. **Lista lobby** (`/lobbies`)
   - Tab "Le tue" / "Vicine" (già previste da `LobbyTabs`), conteggio per tab.
   - Card: nome campo, sport, orario, `3/5` giocatori, badge stato (Aperta / In corso / Chiusa), CTA "Unisciti" solo se aperta e non piena.
   - Stato vuoto "Le tue": "Non hai lobby attive. Creane una dal campo." + CTA "Trova un campo".
   - Stato vuoto "Vicine": "Nessuna lobby qui intorno. Sii il primo." + CTA "Trova un campo" (si crea una lobby dal dettaglio del campo, non dalla lista).
   - Loading: 3 skeleton card.
2. **Dettaglio lobby** (route nuova `/lobbies/[id]`)
   - Header con nome campo e sport; orario grande; partecipanti (avatar iniziali + "3/5"); stato; requisito karma se presente.
   - CTA primaria unica: "Unisciti" oppure "Esci" (secondaria) se sei dentro; nessuna delle due se piena/chiusa.
   - "Apri il campo" come link secondario.
   - Stato "piena": "Al completo: 5/5. Crea la tua lobby." + CTA "Crea lobby".
   - Stato "in corso": CTA assente, testo "In corso dalle 19:00".
   - Stato "chiusa": CTA assente, "Chiusa".
3. **Crea lobby** (drawer, 1 passo)
   - Orario (datetime-local), max giocatori (2–30, stepper o select), riepilogo "La lobby scade 30 minuti dopo l'orario".
   - CTA "Crea lobby". Errori inline: orario passato, max fuori range, bannato, karma basso.
4. **Join** (drawer di conferma, 1 passo)
   - Riepilogo: campo, orario, posti liberi, requisito karma.
   - CTA "Entra". Stato ottimistico: la card passa a "Sei dentro" e il drawer si chiude.
   - Errore "Posti esauriti": il drawer resta, spiega e propone "Crea la tua lobby".

**Regole di design.**

- **Un contenitore per pipeline**: lista e dettaglio sono pagine; crea e join sono drawer. Mai un drawer che si apre sopra un altro drawer.
- Una sola CTA primaria per frame; "Esci" è secondaria con conferma solo se la lobby è in corso.
- Il dettaglio è raggiungibile a freddo (deep link): non dipende dallo stato della lista.
- Gli orari usano `toLocaleTimeString("it-IT")`; i numeri giocatori `3/5`.
- Il bannato vede il motivo e la data di fine, non un errore generico; la CTA di creazione è disabilitata con spiegazione.

**Stati da includere (toolbar).**

`lista`, `lista-vuota`, `lista-loading`, `dettaglio-aperta`, `dettaglio-piena`, `dettaglio-in-corso`, `dettaglio-chiusa`, `crea`, `crea-errore`, `join`, `join-ottimistico`, `join-pieno`.

**Accessibilità.**

- Tab con `role="tablist"` / `aria-selected`, non solo colore.
- Card interamente cliccabile = un solo focus stop con nome accessibile ("Lobby al campo X, ore 19:00, 3 su 5, aperta").
- Drawer con focus trap, `Esc`, backdrop, restore focus.
- Stato "pieno"/"chiuso" anche in testo, non solo badge.

**Acceptance.**

- Il file apre a 360px e 768px; i 12 stati si cambiano dalla toolbar.
- Nessun drawer dentro un drawer; nessuna CTA doppia.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `lobby.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/lobby.html /tmp/opencode/lobby-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/lobby.html
```

**Riferimenti.** `components/lobby/lobby-tabs.tsx`, `components/lobby/lobby-card.tsx`, `docs/design/patterns/onboarding.md` (Join lobby, Crea lobby), `docs/design/content.md`.

## Resolution

**Stato: in review HITL.** Prototipo pronto, non ancora approvato.

**File:** `docs/design/prototypes/lobby.html` (unico file creato; `proto.css` e `proto.js` non toccati). La riga `lobby.html` in `prototypes/README.md` **non** è stata aggiornata: il vincolo di lane di questo lavoro vieta di modificare la tabella; va aggiornata al merge.

### Cosa è implementato

- **12 stati, tutti dalla toolbar:** `lista`, `lista-vuota`, `lista-loading`, `dettaglio-aperta`, `dettaglio-piena`, `dettaglio-in-corso`, `dettaglio-chiusa`, `crea`, `crea-errore`, `join`, `join-ottimistico`, `join-pieno`.
- **Contenitori:** lista e dettaglio sono pagine; crea e join sono drawer sopra la pagina. Nessun drawer dentro un drawer: "Crea la tua lobby" da `join-pieno` passa allo stato `crea`, sostituendo il pannello.
- **Lista:** tab "Le tue" / "Vicine" con `role="tablist"`, `aria-selected` e frecce; tab contano 3/3. Card con campo, sport, orario, `n/5`, badge Aperta / In corso / Chiusa, "Sei dentro" per le tue, "Unisciti" solo per le aperte non piene. Due vuoti distinti, raggiungibili dalle tab, con "Trova un campo". Loading con 3 skeleton e `role="status"`.
- **Dettaglio:** nome campo e sport, orario grande, avatar iniziali + `3/5`, stato, karma richiesto, "Apri il campo". CTA unica: "Unisciti" (aperta), "Crea lobby" (piena); assente in corso/chiusa, dove lo stato è scritto in testo.
- **Crea:** `datetime-local`, giocatori 2–30 con stepper numerico, riepilogo "La lobby scade 30 minuti dopo l'orario" con orario di chiusura calcolato, CTA "Crea lobby".
- **Crea errore:** orario passato, max fuori range, sospensione con motivo e data di fine, karma 46; CTA disabilitata con spiegazione. I quattro errori sono nello stesso caso coerente (vedi decisioni).
- **Join:** riepilogo campo / orario / posti liberi / karma, CTA "Entra". Ottimistico: drawer chiuso, dettaglio "Sei dentro" 4/5, "Esci" secondaria. "Posti esauriti": drawer aperto con spiegazione e CTA "Crea la tua lobby".
- **Accessibilità:** card = un solo link con nome accessibile completo; drawer con `role="dialog"`, `aria-modal`, focus trap, Esc, backdrop e restore focus; target ≥ 44px; focus visibile su tutti i controlli; icone decorative `aria-hidden`; stato piena/chiusa anche in testo; `prefers-reduced-motion` ereditato da `proto.css`.
- **Copy e dati:** italiano definitivo, Roma/basket/orari/karma plausibili. Font Syne/Source Sans 3 dalla base `proto.css` (nessuna dipendenza esterna). Nessun import dall'app, nessuna fetch, nessun dato reale.

### Decisioni da validare

1. **"Unisciti" sulla card.** La card è un unico focus stop (link al dettaglio); "Unisciti" è l'affordance visiva e il join parte dal dettaglio. Un bottone reale dentro la card aggiungerebbe un secondo focus stop per card, contro il requisito a11y del ticket. Se HITL vuole il join diretto dalla lista, la deroga va scelta esplicitamente.
2. **Ottimistico sul dettaglio.** `join-ottimistico` mostra il dettaglio con "Sei dentro", 4/5 ed "Esci"; la card "Sei dentro" è visibile in `lista` (Pineto 4/5). In un solo frame da 360 non stanno entrambe.
3. **`crea-errore`** combina i quattro errori in un caso coerente: orario 19:00 già passato, max 1, sospensione fino a lunedì 16 novembre (due check-in non rispettati), karma 46. Un solo pannello, CTA disabilitata.
4. **`datetime-local`:** il formato del valore segue la lingua del browser. Chromium headless (en-US) mostra `09:00 PM`; su browser italiano mostra `21:00`. Il riepilogo sotto il campo è sempre `toLocaleTimeString("it-IT")`.
5. **Base `proto.js`:** nasconde con l'attributo `hidden`, ma `.screen`/`.stack` di `proto.css` hanno `display:flex`, che batte lo stile UA. Nel file ci sono una regola locale `[hidden]{display:none!important}` e la toolbar dentro `[data-state-group]`. `proto.css` non è stato modificato: se il pattern regge, va promosso lì.
6. **Font:** Syne e Source Sans 3 arrivano da `proto.css` (la base condivisa li incorpora come data URI): `lobby.html` non ha dipendenze né rete, e resta corretto anche da `file://`.

### Checklist `prototypes/README.md`

- [x] Pipeline, passo e prossimo passo dichiarati nel commento HTML e nella testata.
- [x] Tutti i 12 stati del ticket presenti e raggiungibili dalla toolbar.
- [x] Copy italiano, concreto, senza gergo.
- [x] Una sola CTA primaria per stato (le "Unisciti" delle card sono affordance, non bottoni).
- [x] Touch target ≥ 44px e focus visibile; drawer con focus trap.
- [x] Contrasto AA sui token di `proto.css`.
- [x] `prefers-reduced-motion`: nessuna informazione affidata al movimento.
- [x] Screenshot 360/768 allegati.
- [x] Nessun colore fuori da `proto.css`; solo Syne / Source Sans 3.

### Verifica eseguita

- `grep -L 'proto.css' docs/design/prototypes/lobby.html` → nessun output.
- `grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/lobby.html` → nessun output.
- `python3 -m http.server 4177 --directory docs/design/prototypes` + `npx playwright screenshot --viewport-size="360,780"` e `"768,900"` → screenshot sotto.
- Playwright su 360×780 e 768×900: un solo stato visibile per volta, nessuno scroll orizzontale (pagina e `.phone`), max 1 CTA primaria, tutti i target ≥ 44px, nessun errore console; tab e vuoti funzionanti; Esc, backdrop, focus trap e restore focus verificati; nessun drawer impilato.
- Apertura `file://` verificata: font caricati, `proto.css` applicato, nessun errore.

**Screenshot:**
- `/tmp/opencode/lobby-360.png` (viewport 360×780)
- `/tmp/opencode/lobby-768.png` (viewport 768×900)
- `/tmp/opencode/lobby-360-full.png` e `/tmp/opencode/lobby-768-full.png` (full page, schermata intera)
- `/tmp/opencode/lobby-states/` (12 PNG per stato, 328px reali dentro `.phone` a 360)

### Aperto per HITL

- Approvare la deroga card/"Unisciti" o chiedere il join diretto dalla lista.
- Dettaglio confermato come pagina (non drawer), come da ticket.
- Aggiornare la riga `lobby.html` in `prototypes/README.md`.

