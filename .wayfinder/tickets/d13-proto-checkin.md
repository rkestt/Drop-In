---
id: d13
type: design
hitl: true
claimed: false
blocked_by: []
---
## Question

**Obiettivo.** Prototipare il check-in: un solo passo, con tutti gli errori che possono capitare davvero (permesso, GPS, timeout, fuori raggio, già dentro) e un successo che dice fino a quando vale.

**File coinvolti.** `docs/design/prototypes/checkin.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Frame da includere (toolbar).**

1. **Idle** — drawer con nome campo, finestra del check-in, riga "Serve il GPS: ti verifichiamo entro 50 m", CTA primaria "Fai check-in", secondaria "Annulla".
2. **Loading** — CTA disabilitata, label "Verifica posizione…", `aria-busy`, nessun secondo tap.
3. **Permesso negato** — causa + recovery nello stesso blocco: "Permesso posizione negato. Abilitalo nelle impostazioni e riprova." + "Riprova" + "Come fare" (testo, non link esterno).
4. **Fuori raggio** — distanza reale ("Sei a 120 m dal campo"), "Avvicinati e riprova" + "Aggiorna posizione".
5. **Posizione non disponibile / timeout** — "Non riusciamo a leggere la posizione. Esci all'aperto e riprova." + "Riprova".
6. **Già dentro** — lo stato sostituisce la CTA: "Sei qui dalle 18:02, check-in attivo fino alle 20:02" + "Fai check-out" secondaria. Nessun secondo check-in.
7. **Successo** — pop (`--success`), "Check-in attivo fino alle 19:40" (calcolato dall'ora), effetto sul karma se previsto, CTA "Chiudi". Il testo resta anche senza animazione.
8. **Errore server** — "Non siamo riusciti a salvare il check-in. Riprova." + "Riprova", dati conservati.

**Regole di design.**

- Nessuno stepper: il check-in è un passo solo.
- Un solo contenitore: drawer. Niente pagina intermedia.
- Ogni errore ha **causa + recovery** nello stesso blocco; il toast da solo non è recovery.
- Il successo dice l'**effetto e la scadenza**, non "Operazione completata".
- Il pulsante non è mai tappabile due volte durante la richiesta.
- Fuori raggio: mostrare la distanza vera, non un messaggio generico; il raggio è 50 m.

**Stati da includere (toolbar).**

Tutti gli 8 sopra, più `reduced-motion` (nota: nessun pop, testo e outline restano).

**Accessibilità.**

- Drawer `role="dialog"`, titolo collegato, focus trap, `Esc`/backdrop.
- `role="status"` / `aria-live="polite"` per successo e loading; `aria-live="assertive"` solo per l'errore bloccante.
- Il pop non è l'unico segnale: testo "Check-in attivo…" sempre presente.
- Target ≥ 44px, focus visibile.

**Acceptance.**

- Il file apre a 360px e 768px; tutti gli stati si cambiano dalla toolbar.
- Ogni errore ha recovery; il successo ha scadenza e testo; nessuno stepper.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `checkin.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/checkin.html /tmp/opencode/checkin-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/checkin.html
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (Check-in), `components/check-in/check-in-sheet.tsx` (stati esistenti), `docs/design/content.md`.

## Resolution

(TBD — esito review, copy approvato, stati mancanti, screenshot.)
