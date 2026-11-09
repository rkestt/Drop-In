# Checklist

## Pre-PR

### Token e colori

- [ ] Nessun colore hardcoded (`#hex`, `rgb()`, `hsl()`, `oklch()`) fuori da `app/globals.css`.
- [ ] Token aggiunti solo se necessari e documentati in `tokens.md`.
- [ ] Nessuna classe Tailwind `dark:`.
- [ ] Tema unico dark: nessun `text-white` su accent/danger (usare `--accent-foreground` / `--danger-foreground`).
- [ ] Radius dalle utility tokenizzate (`rounded-control`, `rounded-card`, `rounded-sheet`, `rounded-chip`); type display/label dai token (`text-display*`, `text-label`).

### Contrasto e accessibilità

- [ ] Testo principale passa AA su `bg-base`, `bg-surface`, `bg-elevated`.
- [ ] Testo su accent (`accent-foreground`): verificare 4.5:1 per testo normale; se il contrasto è < 4.5 usare solo testo grande (≥18px o ≥14px bold) o icone.
- [ ] Focus visibile con anello accent su ogni elemento interattivo.
- [ ] `aria-label` su icone e FAB.
- [ ] `aria-live` per aggiornamenti dinamici.

### Touch target

- [ ] Ogni elemento tappabile è almeno 44x44px.
- [ ] Bottom nav link 48px.
- [ ] FAB 56px.
- [ ] Handle sheet 44px.

### Stati

- [ ] Default, hover, active, focus, disabled definiti per ogni componente interattivo.
- [ ] Stato di errore previsto per input.
- [ ] Stato di loading previsto per azioni asincrone.

### Motion

- [ ] Transizioni coerenti con il sistema (150ms default).
- [ ] `prefers-reduced-motion` rispettata.
- [ ] Niente animazioni decorative non necessarie.

### Static checks

- [ ] `npm run lint` passa.
- [ ] `npx tsc --noEmit` passa.
- [ ] `npm run lint:design` passa.
- [ ] `npm run test:visual` passa (baseline Linux; aggiornare con `npm run test:visual -- --update-snapshots` solo se il cambio visivo è voluto).
- [ ] `npm run test:a11y` passa (axe).

## Post-PR / pre-merge

- [ ] Dev server su `localhost:3000` funziona.
- [ ] Screenshot a 360px della schermata modificata.
- [ ] Screenshot desktop della stessa schermata.
- [ ] Nessun errore console (hydration inclusa).
- [ ] Reload della pagina non rompe lo stato.
- [ ] Toggle di stati (focus, disabled, loading, error) funzionano.
- [ ] `npm run test:all` verde.
- [ ] Approvazione @designer + @oracle + @tester.
