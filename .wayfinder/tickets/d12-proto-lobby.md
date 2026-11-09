---
id: d12
type: design
hitl: true
claimed: false
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

(TBD — esito review, decisione dettaglio pagina vs drawer, stati approvati, screenshot.)
