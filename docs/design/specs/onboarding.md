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
   **Accedi per salvare i progressi** (nota inline: «Si apre il drawer di
   accesso. Poi torni al passo 3.» — nessun secondo dialog).

Coach mark: etichetta «Suggerimento», titolo «Fai check-in qui quando arrivi»,
corpo «Il GPS ti conferma a meno di 50 m.», azioni «Ho capito» + X
(«Chiudi il suggerimento»).

Nessun dato finto: nessun nome utente inventato, nessun campo demo.

## A11y

- Dialog con `aria-labelledby` (titolo passo) + `aria-describedby` (corpo);
  focus sul titolo a ogni apertura/cambio passo; focus trap + Esc + tap fuori
  di Base UI; restore focus alla chiusura.
- Stepper leggibile senza colore (testo + `aria-current="step"`).
- Target ≥ 44px: Salta, Indietro, Ho capito, X, CTA full-width.
- Coach mark `role="note"` con titolo focalizzabile; chiusura via tastiera;
  `role="status"` sulla nota login.

## File

- `components/onboarding/first-run.tsx`, `components/onboarding/coach-mark.tsx`
- `lib/onboarding/storage.ts` (+ `tests/unit/onboarding-storage.test.ts`)
- `components/ui/drawer.tsx`: passthrough `labelledBy`/`describedBy`/`initialFocus`
- Mount: `app/(app)/page.tsx` (`<FirstRun />`), `app/(app)/courts/[id]/page.tsx`
  (`<CoachMark feature="check-in">` attorno a `CheckInButton`)

## Screenshot

Verifica @tester: 360px + 768px, drawer al primo avvio, reload → non riappare,
console pulita (vedi Resolution del ticket).
