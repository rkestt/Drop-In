---
id: d9
type: design
hitl: true
claimed: false
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

(TBD — esito review, modifiche richieste, stato approvato, screenshot allegati.)
