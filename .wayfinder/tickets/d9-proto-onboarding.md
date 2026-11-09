---
id: d9
type: design
hitl: true
claimed: true
blocked_by: []
---
## Question

**Obiettivo.** Prototipare il primo avvio: 3 passi sopra la mappa, una volta sola, skippabili. Deve spiegare cosa fa Drop-In senza diventare un tour di 10 schermate.

**File coinvolti.** `docs/design/prototypes/onboarding.html` (nuovo). Usa `proto.css` e `proto.js` già presenti; non modificarli. Aggiorna la tua riga nella tabella di `docs/design/prototypes/README.md`.

**Decisione di design (vincolante per il prototipo).**

- Non è una route: è un **drawer sopra la mappa**, aperto al primo avvio. La mappa resta visibile dietro (contesto), il drawer occupa al massimo il 70% dell'altezza.
- 3 passi, non di più. Titolo = cosa può fare l'utente, non nome della feature.
  1. **"Trova il campo più vicino"** — la mappa è il navigatore; CTA primaria "Inizia"; uscita secondaria "Salta".
  2. **"Fai check-in quando arrivi"** — spiega il GPS a 50 m e il karma in una riga; CTA "Avanti"; "Indietro" visibile.
  3. **"Entra in una lobby o creane una"** — CTA primaria "Cerca un campo"; secondaria "Accedi per salvare i progressi" (apre il drawer di accesso, non un secondo flusso).
- Stepper testuale "Passo 1 di 3" + `aria-current="step"`, non solo pallini colorati.
- "Salta" sempre visibile, 44px, chiude e segna l'onboarding come visto.
- Frame extra: **coach mark contestuale** nella scheda campo ("Fai check-in qui quando arrivi"), mostrato una volta sola, non copre il bottone che spiega, chiusura esplicita.
- Persistenza descritta nel prototipo (nota in fondo, non implementata): chiave `dropin:onboarded:v1` in `localStorage`.

**Stati da includere (toolbar).**

`step-1`, `step-2`, `step-3`, `coach-mark`, `reduced-motion` (nota che mostra cosa resta senza animazione).

**Copy.** Italiano, concreto, una cosa per riga. Niente "Benvenuto in Drop-In, l'app che…". Frasi corte, tono da strada. La CTA dice l'effetto ("Cerca un campo"), non "OK".

**Accessibilità.**

- Drawer con `role="dialog"`, `aria-modal="true"`, titolo collegato; focus sul titolo all'apertura; `Esc` e tap fuori chiudono; restore focus.
- Stepper leggibile da screen reader; "Salta" e "Indietro" ≥ 44px.
- Con reduced motion: cambio passo istantaneo, nessun pop; l'informazione resta nel testo.

**Acceptance.**

- Il file apre a 360px e 768px senza scroll orizzontale; i 5 stati si cambiano dalla toolbar.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app; nessuna fetch.
- I 3 passi + coach mark sono completi, con copy definitivo.
- La checklist di `docs/design/prototypes/README.md` è compilata.
- Review HITL: Andrea approva o elenca le modifiche; l'esito va nella Resolution.
- `prototypes/README.md`: riga `onboarding.html` → "in review"/"approvato".

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/onboarding.html /tmp/opencode/onboarding-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/onboarding.html
grep -rn 'docs/design/prototypes' app components lib
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (coach mark, un solo prossimo passo), `docs/design/prototypes/README.md`, `docs/design/principles.md` §6.

## Resolution

**Stato: in review HITL (2026-11-09).** File creato:
`docs/design/prototypes/onboarding.html`. Non è una route e non è importato
dall’app; si apre da `http://localhost:4173/onboarding.html` e da `file://`.

**Cosa contiene.**
- Drawer modale sopra la mappa, 3 passi: `step-1`, `step-2`, `step-3`, più il
  frame `coach-mark` e lo stato `reduced-motion`; tutti raggiungibili dalla
  toolbar. Stepper testuale «Passo X di 3» + `aria-current="step"` e tre barre.
- «Salta» in ogni passo (44px), «Indietro» ai passi 2–3. «Inizia», «Avanti» e
  «Indietro» cambiano davvero stato. «Cerca un campo» chiude; «Accedi per
  salvare i progressi» apre una nota inline, senza un secondo dialog.
- Salta / Esc / tap fuori chiudono il drawer, mostrano lo stato «Onboarding
  segnato come visto» e riportano il focus sulla mappa.
- Coach mark nella scheda campo (`Parco delle Valli`): sta sopra la card, non
  copre «Check-in», si chiude con «Ho capito» o la X e riporta il focus sul
  bottone Check-in.
- Reduced motion: stato dedicato + `prefers-reduced-motion` reale; il passo
  cambia senza animazione e l’informazione resta in testo, titolo e focus.
- Persistenza descritta nella nota in fondo: `dropin:onboarded:v1` e
  `dropin:coach:check-in`, non implementata. Mappa e dati sono finti e
  plausibili; nessun dato reale, nessuna fetch.
- Font Syne / Source Sans 3 dalla base condivisa `proto.css` (che ora li
  incorpora); il file non duplica `@font-face`.

**Check automatici eseguiti.**
```bash
grep -L 'proto.css' docs/design/prototypes/onboarding.html        # vuoto
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/onboarding.html  # vuoto
grep -rn 'docs/design/prototypes' app components lib             # nessun match
```
Playwright a 360×780 e 768×900: `scrollWidth === clientWidth`
(360/360, 768/768); 0 errori console; 0 richieste esterne; font caricati.
Altezze drawer: 50,6% / 54,6% / 60,2% (passi), 32,1% (coach), 66,8%
(reduced), 68,5% con la nota login; tutte sotto il 70%, nessuno scroll interno.
Interazioni verificate: Inizia→passo 2, Indietro→passo 1, Salta/Esc/tap fuori
chiudono con focus sulla mappa, coach dismissibile con focus su Check-in.
A11y: 4 dialog con nome e `aria-modal`, focus sul titolo a ogni apertura
(anche al primo load), Tab intrappolato, un solo `aria-current="step"` per
stato, target tutti ≥44×44, focus ring sui controlli. Reduced motion reale:
animazione d’ingresso 0,25s → 0,01ms.

**Checklist README (compilata).**
- [x] Pipeline, passo e prossimo passo dichiarati nel commento in cima e nella
  meta «d9 · in review HITL»; prossimo passo: approvazione → d17.
- [x] Tutti gli stati del ticket presenti e raggiungibili dalla toolbar.
- [x] Copy in italiano, concreto, una cosa per riga; niente gergo tecnico.
- [x] Una sola CTA accent per schermata; target ≥44px; focus visibile sui
  controlli (il titolo riceve il focus per gli screen reader, senza anello:
  non è un controllo).
- [x] Solo token semantici di `proto.css`; nessun hex; contrasto AA.
- [x] `prefers-reduced-motion`: nessuna informazione affidata al movimento.
- [x] Screenshot 360px e 768px allegati (sotto).
- [x] Nessun font fuori da Syne / Source Sans 3; nessun colore inventato.

**Screenshot.**
- `/tmp/opencode/onboarding-360.png` e `/tmp/opencode/onboarding-768.png`
  (comandi del ticket).
- Per stato: `/tmp/opencode/d9-step-1-360.png`, `d9-step-2-360.png`,
  `d9-step-3-360.png`, `d9-coach-mark-360.png`, `d9-reduced-motion-360.png`
  (stessa serie a `-768.png`).
- Extra: `d9-closed-360.png`, `d9-step-3-login-360.png`,
  `d9-coach-dismissed-360.png`.

**Da guardare in review.**
1. Copy definitivo dei 3 passi e del coach: tono, «Cerca un campo», «Accedi
   per salvare i progressi».
2. Altezze del drawer (50–60%) e peso dello scrim al 75% di `--overlay`: la
   mappa resta abbastanza leggibile?
3. Posizione del coach sopra la card e dello stato di chiusura a metà mappa:
   sono il punto giusto o preferisci un toast in basso?
4. Focus sul titolo senza anello visivo (scelta per non far sembrare il titolo
   un input); i controlli hanno l’anello. Va bene per la review?
5. `proto.css` è stato aggiornato in parallelo con i font: il prototipo non li
   duplica. Se quel cambio non entra, il file usa il fallback di sistema.

**Residui.** La tabella di `docs/design/prototypes/README.md` non è stata
toccata su istruzione dell’orchestratore: la riga `onboarding.html` è ancora
`da fare` e va portata a `in review` da chi possiede il file. Persistenza
`localStorage`, drawer reale (d5) e motion (d7) restano per d17. La mappa è un
disegno statico: nessun tile, nessun dato reale.

