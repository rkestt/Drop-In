---
id: d10
type: design
hitl: true
claimed: true
blocked_by: []
status: closed
closed_at: 2026-11-10
---
## Question

**Obiettivo.** Prototipare la schermata Impostazioni: notifiche, posizione, account, informazioni. Solo cose che l'app può davvero fare oggi; niente voci finte.

**File coinvolti.** `docs/design/prototypes/settings.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Struttura (una pagina, sezioni).**

1. **Notifiche**
   - Riga "Avvisi nell'app": link al centro notifiche, sempre disponibile.
   - Switch "Pallino degli avvisi non letti": preferenza reale, salvata in locale.
   - Riga "Notifiche push": **disabilitata** con spiegazione "Non disponibili in questa versione: richiedono l'invio dal server". Non simulare un permesso che non produce nulla.
   - Nota nel prototipo: il delivery push è fuori scope; quando esisterà, questa riga diventa lo switch del permesso.
2. **Posizione**
   - Riga stato: "Consentita" / "Negata" / "Da chiedere".
   - Spiegazione: serve per mappa, check-in 50 m, lobby vicine.
   - Azione "Riprova" quando negata, con istruzioni per Safari/Chrome.
3. **Account**
   - Email (sola lettura), nickname con link "Modifica" (apre il drawer del profilo), "Esci" come azione secondaria con conferma.
   - **Non** includere "Elimina account": richiede service role e non è in questo piano.
4. **Informazioni**
   - Versione app, licenze mappa/OSM, link privacy, "Segnala un problema".
   - Attribuzione OpenFreeMap/OpenMapTiles leggibile.

**Stati da includere (toolbar).**

`default`, `notifiche-off`, `push-non-disponibile`, `posizione-negata`, `posizione-concessa`, `loading`, `logout-confirm`, `toast-successo`.

**Regole di design.**

- Riga impostazione = label + stato + controllo, altezza ≥ 56px; il tap sull'intera riga attiva il controllo quando è uno switch.
- Un solo accent per schermata: lo switch attivo. "Esci" è danger ma non accent.
- La conferma di logout è un **drawer**, non un modal a catena. L'azione che l'utente ha scelto è "Esci": primaria `danger`; "Annulla" secondaria. Niente doppia conferma.
- Testi in italiano; niente "Settings", "Push notifications", "Privacy Policy".
- Niente bottom nav: Impostazioni è dentro `(dashboard)`, header con "Indietro". Coerente con `app/(dashboard)/layout.tsx`.

**Accessibilità.**

- Switch con `role="switch"` e `aria-checked`; label associata; stato non affidato al solo colore.
- Focus visibile su switch, link e bottoni; `aria-live="polite"` sul cambio di stato permesso.
- Target ≥ 44px, anche per i link di aiuto.

**Acceptance.**

- Il file apre a 360px e 768px; gli 8 stati si cambiano dalla toolbar.
- Nessuna voce che prometta funzioni inesistenti (niente delivery push attivo, niente delete account).
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `settings.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/settings.html /tmp/opencode/settings-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/settings.html
```

**Riferimenti.** `docs/design/patterns/states.md`, `docs/design/content.md`, `docs/roadmap.md` (push e profilo sono parziali).

## Resolution

**Stato:** in review HITL — 2026-11-09. File: `docs/design/prototypes/settings.html` (prototipo statico, 8 stati, nessun import da `app/`/`components/`, nessuna fetch).

**Stati (8/8, tutti dalla toolbar).** `default` (primo avvio: posizione “Da chiedere”), `notifiche-off`, `push-non-disponibile`, `posizione-negata`, `posizione-concessa`, `loading`, `logout-confirm`, `toast-successo`.

**Interazioni verificate.**

- Switch “Pallino degli avvisi non letti”: `role="switch"`, `aria-checked`, testo Attivo/Spento, pallino sulla campanella, toast e live region; il tap è su tutta la riga.
- “Consenti posizione” / “Riprova”: badge → Consentita, istruzioni nascoste, riga “Non salviamo le tue coordinate”, `aria-live` aggiornata.
- “Esci”: drawer con `role="dialog"`, `aria-modal`, titolo collegato; schermata sotto `inert`; “Annulla”, tap sul backdrop ed Esc tornano a `default`; nessuna doppia conferma.
- Toolbar: ogni stato mostra una sola schermata; `aria-pressed` gestito da `proto.js`.

**Esito check.**

- `grep -L 'proto.css' docs/design/prototypes/settings.html` → vuoto.
- `grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/settings.html` → vuoto.
- Playwright a 360×780 e 768×900: nessuno scroll orizzontale su documento, phone, contenuto e toolbar; console pulita; 8 stati raggiungibili; target visibili ≥44px; focus visibile su switch, link e bottoni; `prefers-reduced-motion` → durate 0.01ms; `file://` apre con font e zero errori; nessuna richiesta esterna.
- Font Syne/Source Sans 3 dalla base condivisa `proto.css` (self-hosted, OFL): nessun font diverso, nessun colore fuori dai token.
- Verifica eseguita sulla porta **4175** (4173 occupata da un'altra lane), non 4173.

**Screenshot.**

- 360: `/tmp/opencode/settings-360.png`; 768: `/tmp/opencode/settings-768.png`; full page 360: `/tmp/opencode/settings-360-full.png`.
- Tutto il contenuto del phone per la review: `/tmp/opencode/settings-360-expanded.png`.
- Stati: `/tmp/opencode/state-<stato>.png` (inclusi `state-posizione-negata-posizione.png`, `state-logout-confirm.png`, `state-loading.png`, `state-toast-successo.png`).
- A 328px (phone reale nel viewport 360): `/tmp/opencode/settings-328-bottom.png`, `settings-328-posizione-negata.png`, `settings-328-posizione-concessa.png`, `settings-328-logout.png`; focus switch: `/tmp/opencode/settings-328-focus-switch.png`.

**Checklist `prototypes/README.md`.**

- [x] Pipeline, passo e prossimo passo nel commento HTML e nel meta.
- [x] Tutti gli 8 stati del ticket presenti e raggiungibili.
- [x] Copy italiano, concreto; nessuna voce che prometta funzioni inesistenti.
- [x] Un solo accent (switch attivo); “Esci” è danger, non accent (secondario in pagina, primario danger nel drawer); target ≥44px; focus visibile.
- [x] Contrasto AA sui token usati (`tokens.md`); nessun colore hardcoded.
- [x] `prefers-reduced-motion`: nessuna informazione affidata al movimento.
- [x] Screenshot 360 e 768 allegati; verifica anche a 328.
- [x] Nessun font diverso da Syne/Source Sans 3; nessun hex nell'HTML.

**Tagli e note.** Push disabilitato (delivery fuori scope, nessun `Notification.requestPermission`; la riga diventa lo switch del permesso quando il server invierà notifiche). Niente “Elimina account” (richiede service role). “Modifica” è solo il link al drawer profilo (d11), non riprodotto. Focus trap del drawer con d5. Lo switch non persiste al reload (chiave `dropin:pref:badge:v1` in d18). “Avvisi” e campanella portano a `/notifications` (d14); privacy e “Segnala un problema” si definiscono in d18.

**README.** La riga `settings.html` della tabella **non** è stata toccata in questa lane per il vincolo di concorrenza: va portata a “in review” al merge. La checklist sopra è compilata.

**Review HITL.** In attesa di Andrea. Da guardare: gerarchia a 328/360, copy della riga push, drawer di uscita, switch del pallino.

**Esito review HITL (2026-11-10):** approvato da Andrea senza modifiche richieste. Le scelte del prototipo sono vincolanti per l'implementazione (copy, gerarchia, stati); i punti aperti segnalati dai designer restano quelli scritti nella Resolution e si chiudono nel ticket di implementazione corrispondente.
