---
id: d13
type: design
hitl: true
claimed: true
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

**Stato: in review HITL.** Prototipo completo, copy in italiano pronto da approvare. Nessuno stato mancante.

**File.** `docs/design/prototypes/checkin.html` (nuovo, unico file scritto). `proto.css` e `proto.js` non toccati; i font self-hosted sono nella base condivisa `proto.css` (data URI, lavoro parallelo), quindi il prototipo non duplica `@font-face`. La tabella di `prototypes/README.md` **non** è stata aggiornata per istruzione dell'orchestratore: la riga `checkin.html` resta `da fare` e va portata a `in review` al merge.

**Stati dalla toolbar (9/9).**

| Toolbar | Stato | Copy / comportamento |
|---|---|---|
| Idle | default | Nome campo, «Check-in aperto ora», «Resta attivo 2 ore…», «Serve il GPS: ti verifichiamo entro 50 m dal campo.», CTA «Fai check-in», secondaria «Annulla» |
| Attesa | loading | CTA disabilitata con spinner e label «Verifica posizione…», `aria-busy`, nessun secondo tap |
| Permesso | permesso negato | «Permesso posizione negato» + «Abilitalo nelle impostazioni e riprova.»; «Come fare» apre i 3 passi inline; «Riprova» |
| Distanza | fuori raggio | «Sei a 120 m dal campo. Avvicinati e riprova.», numero 120 m, meter 0–150 con soglia 50 m, «Aggiorna posizione» |
| Posizione | GPS assente / timeout | «Non riusciamo a leggere la posizione. Esci all'aperto e riprova.» + hint GPS; «Riprova» |
| Già dentro | check-in attivo | «Sei qui dalle 18:02, check-in attivo fino alle 20:02.»; nessuna CTA primaria, solo «Fai check-out» secondaria |
| Successo | successo | Pop `--success`, «Check-in attivo fino alle 19:40», effetto «Sei dentro per 2 ore…», CTA «Chiudi» |
| Salvataggio | errore server | «Non siamo riusciti a salvare il check-in. Riprova.» + «La posizione letta resta valida…»; «Riprova» |
| Senza pop | reduced motion | Stesso successo senza animazione; nota di review che il testo resta |

**Scelte.**
- **Niente karma nel successo**: nel dominio il check-in GPS è presenza, non muove il karma (cfr. `rome-launch-readiness`); nessuna riga inventata.
- **Un solo contenitore**: drawer, nessuno stepper, nessuna pagina intermedia. La scheda campo sotto è semplificata (mappa finta, nome, indirizzo) e la sua CTA sta in fondo, coperta dal drawer in tutti gli stati.
- **Scadenza calcolata** da ora check-in + 2 ore e formattata `it-IT`: 17:40 → 19:40, 18:02 → 20:02. Ore simulate fisse per la review.
- **Check-out**: chiude il drawer; il flusso di check-out non è in questo ticket. Le CTA di recovery sono stati visivi: il flusso si cambia dalla toolbar.
- **Focus trap** attivo sul dialog; la toolbar è fuori (è chrome del prototipo): da tastiera si esce con `Esc` e si cambia stato dalla toolbar.
- **Sheet idle** con `min-height: 424px`: a 768 il testo va a capo meno e lo sheet scenderebbe di 19 px tagliando l'indirizzo.

**Verifiche eseguite (reali).**
- `grep -L 'proto.css' docs/design/prototypes/checkin.html` → nessun output.
- `grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/checkin.html` → nessun output.
- `grep -rn 'docs/design/prototypes' app components lib` → nessun match; solo `proto.css`/`proto.js` come risorse, nessuna fetch, nessuna geolocalizzazione reale.
- 360 e 768: `scrollWidth === innerWidth` (nessuno scroll orizzontale); toolbar 3×3 a 360, una riga a 768; tutti i 9 stati raggiungibili.
- Console/network: 0 errori, 0 richieste esterne; Syne e Source Sans 3 caricati da `proto.css`.
- Accessibilità: 1 sola CTA primaria per stato (0 in «Già dentro», da ticket), target ≥44 px anche in toolbar, focus visibile, trap Tab/Shift+Tab, `Esc` e backdrop chiudono con focus restituito, `aria-live="polite"` su loading/successo e `assertive` sugli errori, `aria-busy` sul loading.
- Reduced motion: con `prefers-reduced-motion: reduce` l'animazione scende a 0.01 ms / 1 iterazione; lo stato «Senza pop» mostra il successo senza pop, testo e bordo restano.
- Scadenza: verificati i valori calcolati 19:40 e 20:02.

**Screenshot.**
- Comandi del ticket (viewport): `/tmp/opencode/checkin-360.png`, `/tmp/opencode/checkin-768.png`.
- Review full page: `/tmp/opencode/checkin-360-full.png`, `/tmp/opencode/checkin-768-full.png`; solo telefono: `/tmp/opencode/checkin-360-phone.png`, `/tmp/opencode/checkin-768-phone.png`.
- Stati a 360: `/tmp/opencode/checkin-360-{idle,loading,denied,range,unavailable,inside,success,server,reduced}.png`; «Come fare» aperto: `/tmp/opencode/checkin-360-denied-open.png`.

**Da guardare in review.**
1. Copy del successo: «Check-in attivo fino alle 19:40» + effetto, senza «Operazione completata».
2. Fuori raggio: 120 m + meter con soglia 50 m; il testo resta la fonte, la grafica è `aria-hidden`.
3. Permesso: ordine «Come fare» (3 passi) → «Riprova»; va bene o va invertito?
4. Già dentro: zero CTA primarie e check-out secondario, come da ticket.
5. Reduced motion: «Senza pop» e nota di review.
6. Tagli del background: l'idle non taglia nome/indirizzo a 360 e 768; gli sheet alti coprono il contesto (voluto).
