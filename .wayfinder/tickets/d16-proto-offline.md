---
id: d16
type: design
hitl: true
claimed: true
blocked_by: []
---
## Question

**Obiettivo.** Prototipare gli stati che di solito si dimenticano: offline con dati in cache, errore di rete, errore imprevisto, vuoti con CTA. Devono dire la verità su cosa funziona e cosa no.

**File coinvolti.** `docs/design/prototypes/offline.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Frame da includere (toolbar).**

1. **Offline con cache** — mappa con banner "Sei offline · dati di 12 min fa" e lista campi in cache; CTA "Riprova". La mappa resta visibile (tile in cache) ma non si aggiorna.
2. **Offline su azione che richiede rete** — check-in o join: banner "Serve la connessione per il check-in", CTA disabilitata con spiegazione. Nessun finto successo.
3. **Riconnessione** — banner `--success` "Di nuovo online" + "Aggiorna" (o refresh automatico); sparisce dopo 3s.
4. **Errore di rete (route)** — `app/error.tsx`: "Non riusciamo a caricare questa pagina", "Riprova" primaria, "Torna alla mappa" secondaria, codice errore attenuato.
5. **Errore critico (global)** — `app/global-error.tsx`: stessa gerarchia, stile minimo, nessuna dipendenza da font/token esterni (deve funzionare se tutto il resto fallisce).
6. **Vuoto mappa** — "Nessun campo da basket in quest'area" + CTA "Aggiungi il primo campo"; non "Nessun risultato".
7. **Vuoto ricerca** — "Nessun campo per «parco»" + "Cancella ricerca"; non un empty state senza uscita.
8. **Vuoto lobby** — "Nessuna lobby qui intorno. Sii il primo." + CTA "Crea una lobby" (o "Trova un campo" se manca il campo).
9. **Vuoto notifiche** — "Nessuna notifica. Ti avvisiamo qui quando cambia qualcosa." + secondaria "Attiva le notifiche".
10. **Offline totale (`/~offline`)** — pagina statica: cosa resta disponibile (mappa in cache, campi visitati), cosa no (check-in, lobby, segnalazioni), CTA "Riprova".

**Regole di design.**

- **Mai un empty state durante il caricamento**: prima skeleton, poi vuoto.
- Ogni vuoto ha una via d'uscita: CTA che avvia la pipeline o azione che pulisce il filtro.
- Offline ≠ errore: il tono è informativo, non allarmistico; `--warning` per offline, `--danger` per errore.
- Le azioni che non possono funzionare offline sono disabilitate **con spiegazione**, non nascoste.
- L'errore critico non usa i token dell'app se non sono disponibili: testo e colori leggibili anche senza CSS caricato.

**Accessibilità.**

- Banner con `role="status"`; errori con `role="alert"`.
- Il cambio online/offline è annunciato una volta, non in loop.
- Focus visibile su "Riprova"; target ≥ 44px.
- Nessuna informazione affidata solo al colore (testo "Sei offline" sempre presente).

**Acceptance.**

- Il file apre a 360px e 768px; i 10 stati si cambiano dalla toolbar.
- Nessun frame mostra un successo finto o un empty state durante il loading.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `offline.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/offline.html /tmp/opencode/offline-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/offline.html
```

**Riferimenti.** `docs/design/patterns/states.md`, `docs/research/pwa-offline.md`, `app/~offline/page.tsx`, `app/error.tsx`, `app/global-error.tsx`.

## Resolution

**Stato: in review HITL** (prototipo pronto, non approvato). File creato:
`docs/design/prototypes/offline.html`, 13 stati nella toolbar. `proto.css` e
`proto.js` non toccati; nessun file in `app/` o `components/`.

**Mappa ticket → stati.** 1 offline con cache → `02`; 2 offline su azione
(check-in) → `03`; 3 riconnessione → `06` (`--success`, sparisce dopo 3s);
4 errore di rete (route) → `07`; 5 errore critico (global) → `08`;
6 vuoto mappa → `09`; 7 vuoto ricerca → `10`; 8 vuoto lobby → `11`;
9 vuoto notifiche → `12`; 10 offline totale `/~offline` → `13`.
In più, per la review: `01` caricamento (skeleton, nessun vuoto), `04` retry in
corso e `05` retry fallito (sotto-stati del punto 1). "Offline senza cache" è
lo stato `13`: la pagina statica servita quando la route non è in cache.

**Esiti verifica** (server sulla porta 4181 come da mandato; il ticket indicava 4173):
- `grep -L 'proto.css' docs/design/prototypes/offline.html` → nessun output.
- `grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/offline.html` → nessun output.
- `http://localhost:4181/offline.html` → 200; `file:///.../offline.html` → 200,
  CSS caricato, 0 errori console. Nessun import da `app/`/`lib`, nessuna fetch
  (unica URL: il namespace SVG).
- 360 e 768: `scrollWidth == innerWidth` (360 e 768), nessuno scroll orizzontale.
- 13/13 stati: uno solo visibile per volta, `.phone` 780px, 0 overflow
  verticale, 0 elementi fuori dalla cornice; tutti i `button` ≥ 44×44.
- Colori calcolati: solo token di `proto.css` e le opacità già definite lì.
  Eccezione voluta lo stato `08` (Canvas/CanvasText/ButtonFace/ButtonText/
  LinkText/GrayText) + i fallback `rgb(0,0,0)`/`rgb(255,255,255)`.
- Focus: anello `2px var(--focus-ring)` su CTA, chip, back e select.
- Riconnessione: banner visibile a 0s; a 3,4s banner nascosto e riga
  "Aggiornato ora · 3 campi vicini" visibile (`role="status"`).
- Reduced motion: skeleton e spinner si fermano; nessuna informazione affidata
  al movimento.

**Screenshot.**
- `/tmp/opencode/offline-360.png` (360×780, stato `02`)
- `/tmp/opencode/offline-768.png` (768×900, stato `02`)
- full page: `/tmp/opencode/offline-360-full.png`, `/tmp/opencode/offline-768-full.png`
- tutti gli stati: `/tmp/opencode/offline-frames/<stato>-360.png`
- contact sheet: `/tmp/opencode/offline-all-360.png`

**Scelte da validare in review.**
1. Copy: "cache" sparisce dal testo utente → "Campi salvati", "Mappa salvata ·
   non si aggiorna". Il gergo resta solo nei commenti.
2. Check-in offline: CTA `aria-disabled` (resta focalizzabile, così la
   spiegazione è raggiungibile), non `disabled`; nessun finto successo.
3. Errore critico `08`: colori e font di sistema, niente token. Deve sembrare
   la pagina che sopravvive al CSS mancante, non una schermata dell'app.
4. Vuoto mappa: messaggio come banner sopra la mappa (`patterns/map.md`), non
   una pagina vuota; "Aggiungi il primo campo" è l'unica CTA accent.
5. Vuoto notifiche: nessuna CTA primaria, "Attiva le notifiche" è secondaria
   come da ticket. È l'unico stato senza accent: confermare.
6. Nav in basso non interattiva (span): è chrome di prototipo, non un link.
7. Disabilitato: la CTA del check-in usa l'opacità 50% del Button di
   produzione, non uno stile neutro nuovo. Se in review non si legge come
   disabilitata, si cambia il componente in d24, non il prototipo.

**Aperto / fuori scope.**
- Riga `offline.html` in `prototypes/README.md`: lasciata "da fare" come da
  mandato (la tabella non andava toccata). Da aggiornare a review/approvato.
- `proto.css` non ha `@font-face`: i due font (Syne, Source Sans 3) sono
  incorporati in base64 nel file, come negli altri prototipi della serie, così
  rendono anche da `file://`. Se un giorno i font passano in `proto.css`,
  questi blocchi si tolgono da qui.
- Checklist README compilata: pipeline dichiarata; 10+3 stati raggiungibili;
  copy italiano; un solo accent per stato (tranne `12`, motivato); AA sui
  token usati; reduced motion; screenshot 360/768; nessun colore o font fuori
  da `proto.css` tranne lo stato `08` (richiesto dal ticket).
