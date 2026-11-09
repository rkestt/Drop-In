---
id: d16
type: design
hitl: true
claimed: false
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

(TBD — esito review, copy offline, stati approvati, screenshot.)
