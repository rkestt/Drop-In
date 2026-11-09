---
id: d10
type: design
hitl: true
claimed: false
blocked_by: []
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

(TBD — esito review, voci tagliate, stato approvato, screenshot.)
