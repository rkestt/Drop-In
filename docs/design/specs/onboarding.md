# Spec — Primo avvio (onboarding)

## Obiettivo

Spiegare in 3 passi cosa fa Drop-In al primo avvio, senza bloccare chi vuole
usare subito la mappa.

## Stati

- **Primo avvio** (`dropin:onboarded:v1` assente, drawer non ancora chiuso in
  sessione): drawer Base UI sopra la mappa, max 70% dell'altezza (`max-h-[70dvh]`,
  portal: nessuno shift di layout). Mappa visibile dietro il backdrop, non tappabile.
- **Passo 1–3**: stepper testuale «Passo X di 3» + 3 barre, `aria-current="step"`
  solo sullo step corrente, label screen-reader per completati/correnti/futuri.
  «Salta» sempre visibile (44px). «Indietro» dai passi 2–3.
- **Chiuso**: «Salta», CTA finale, Esc e tap fuori scrivono `dropin:onboarded:v1`
  e chiudono. Reload → non riappare. La chiusura in sessione vale anche se lo
  storage non scrive (Safari privato): nessun crash, app usabile.
- **Coach mark check-in**: prima apertura di una scheda campo
  (`dropin:coach:check-in` assente), dopo il primo render. Sta nel flusso sopra
  il bottone: non lo copre mai. Si chiude con «Ho capito», X o Esc; il focus
  torna sul bottone Check-in. Chiuso → non torna.
- **Reduced motion**: cambio passo istantaneo via `StepTransition` (ramo statico,
  nessun transform inline); la media query globale azzera le transizioni. Info
  in testo, titolo e focus invariati.

## Copy (definitivo, dal prototipo approvato d9)

1. **Trova il campo più vicino** — «La mappa è il navigatore.» / «Tocca un campo
   e vedi chi gioca.» — CTA **Inizia**.
2. **Fai check-in quando arrivi** — «Check-in valido entro 50 m.» / «Se non ti
   presenti a una lobby, perdi 3 punti karma.» — CTA **Avanti**.
3. **Entra in una lobby o creane una** — «C’è già una partita? Entra.» /
   «Non c’è? Aprine una.» — CTA **Cerca un campo** (chiude), secondaria
   **Accedi per salvare i progressi** (chiude l’onboarding segnandolo come
   visto e apre il `LoginModal` di pagina in un microtask — niente modali a
   catena, si torna alla mappa loggati).

Coach mark: etichetta «Suggerimento», titolo «Fai check-in qui quando arrivi»,
corpo «Il GPS ti conferma a meno di 50 m.», azioni «Ho capito» + X
(«Chiudi il suggerimento»).

Nessun dato finto: nessun nome utente inventato, nessun campo demo.

## A11y

- Dialog con `aria-labelledby` (titolo passo) + `aria-describedby` (corpo);
  focus sul titolo a ogni apertura/cambio passo; focus trap + Esc + tap fuori
  di Base UI; restore focus alla chiusura.
- Alla chiusura il focus torna al FAB «Aggiungi un campo» (`finalFocus` su un
  controllo foglia stabile): al primo avvio niente aveva il focus e il
  restore di default lo lascerebbe sul `body`. Non il contenitore mappa:
  Base UI lo risolverebbe al primo figlio tabbabile (canvas o select a
  seconda del caricamento: non deterministico). Il drawer è modale, quindi
  alla chiusura l'utente non sta interagendo altrove: nessun furto di focus.
- Stepper leggibile senza colore (testo + `aria-current="step"`).
- Target ≥ 44px: Salta, Indietro, Ho capito, X, CTA full-width.
- Coach mark `role="note"` con titolo focalizzabile; chiusura via tastiera;
  flag di sessione per feature (in Safari privato non riappare a ogni scheda).

## File

- `components/onboarding/first-run.tsx`, `components/onboarding/coach-mark.tsx`
- `lib/onboarding/storage.ts` (+ `tests/unit/onboarding-storage.test.ts`)
- `components/ui/drawer.tsx`: passthrough `labelledBy`/`describedBy`/`initialFocus`/`finalFocus`
- Mount: `app/(app)/page.tsx` (`<FirstRun onLogin returnFocusRef>` verso
  `LoginModal` e FAB «Aggiungi un campo»), `app/(app)/courts/[id]/page.tsx`
  (`<CoachMark feature="check-in">` attorno al blocco azioni: la scheda si
  apre anche senza login e l'acceptance chiede il coach alla prima apertura)

## Screenshot

Verifica @tester: 360px + 768px, drawer al primo avvio, reload → non riappare,
console pulita (vedi Resolution del ticket).
