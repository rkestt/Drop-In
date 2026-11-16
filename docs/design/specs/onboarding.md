# Spec — Primo avvio (onboarding)

## Obiettivo

Spiegare in 4 passi cosa fa Drop-In al primo avvio e far scegliere subito lo
sport, senza bloccare chi vuole usare la mappa.

## Stati

- **Primo avvio** (`dropin:onboarded:v1` assente, drawer non ancora chiuso in
  sessione): drawer Base UI sopra la mappa, max 70% dell'altezza (`max-h-[70dvh]`,
  portal: nessuno shift di layout). Mappa visibile dietro il backdrop, non tappabile.
- **Passo 1 — sport**: griglia di chip a 2 colonne (4 da 640px), 8 opzioni:
  le 7 discipline + «Tutti», single-select, chip ≥ 44px. Preselezionato
  «Basket» (default del provider). La scelta scrive subito in `sport`
  (`localStorage`, «Tutti» = `all`): nessun «Salva», la CTA avanza soltanto.
  Chiudere il drawer lascia lo sport scelto (non toccato = Basket).
- **Passo 1–4**: stepper testuale «Passo X di 4» + 4 barre, `aria-current="step"`
  solo sullo step corrente, label screen-reader per completati/correnti/futuri.
  «Salta» sempre visibile (44px). «Indietro» dai passi 2–4.
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

## Copy (definitivo; passi 2–4 dal prototipo approvato d9, passo 1 da #45)

1. **Che sport giochi?** — «La mappa si apre sul tuo sport. Puoi cambiarlo
   quando vuoi da Impostazioni.» — chip **Basket · Calcio · Tennis · Padel ·
   Calcio a 5 · Pallavolo · Polivalente · Tutti** — CTA **Inizia**.
2. **Trova il campo più vicino** — «La mappa è il navigatore.» / «Tocca un campo
   e vedi chi gioca.» — CTA **Avanti**.
3. **Fai check-in quando arrivi** — «Check-in valido entro 50 m.» / «Se non ti
   presenti a una lobby, perdi 3 punti karma.» — CTA **Avanti**.
4. **Entra in una lobby o creane una** — «C’è già una partita? Entra.» /
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
- Passo 1: `role="radiogroup"` nominato dal titolo del passo, opzioni
  `role="radio"` + `aria-checked`; una sola tab stop (roving tabindex) e
  frecce che spostano selezione e fuoco in ciclo. Lo stato non è solo colore:
  bordo `--accent`, fondo `--accent-subtle`, spunta visibile.
- Target ≥ 44px: chip, Salta, Indietro, Ho capito, X, CTA full-width.
- Coach mark `role="note"` con titolo focalizzabile; chiusura via tastiera;
  flag di sessione per feature (in Safari privato non riappare a ogni scheda).

## File

- `components/onboarding/first-run.tsx`, `components/onboarding/coach-mark.tsx`
- `components/onboarding/sport-step.tsx` (passo 1) + `components/sport/sport-chip-group.tsx`
  (gruppo di chip riusato in Impostazioni)
- `lib/onboarding/storage.ts` (+ `tests/unit/onboarding-storage.test.ts`)
- `components/ui/drawer.tsx`: passthrough `labelledBy`/`describedBy`/`initialFocus`/`finalFocus`
- Mount: `app/(app)/page.tsx` (`<FirstRun onLogin returnFocusRef>` verso
  `LoginModal` e FAB «Aggiungi un campo»), `app/(app)/courts/[id]/page.tsx`
  (`<CoachMark feature="check-in">` attorno al blocco azioni: la scheda si
  apre anche senza login e l'acceptance chiede il coach alla prima apertura)

## Scostamenti dal prototipo d9

- **Passo 1 sport** aggiunto con #45 dopo l'approvazione del prototipo (che
  resta a 3 passi e non viene ridisegnato). Conteggio 3 → 4: «Inizia» passa al
  passo 1, «Trova il campo più vicino» usa «Avanti».
- **Altezza del drawer invariata** (`max-h-[70dvh]`): il passo 1 misura ~510px
  e sta nei 546px di un 360×780. Sotto i ~700px di altezza il drawer scrolla
  (è `overflow-y-auto`) e la CTA si raggiunge con uno scroll: non si alza il
  foglio né si rende la CTA sticky.
- Testo del passo 1 a `text-sm` (non `text-base` come gli altri): qui il corpo
  è di supporto alla griglia, che è il contenuto.

## Screenshot

Verifica @tester: 360px + 768px, drawer al primo avvio (passo 1 con la griglia,
passo 4 con le due CTA), reload → non riappare, console pulita (vedi
Resolution del ticket).
