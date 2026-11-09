# Workflow di design

## Fasi

```
brief → references → prototype → design review → implementazione → verifica live → ship
```

### 1. Brief

- Problema, obiettivo, vincoli (mobile-first, un solo tema, performance).
- Pubblico e contesto d’uso (strada, sole, mani grandi, fretta).
- **Pipeline e passo**: ogni schermata dichiara a quale pipeline appartiene (submit-court, check-in, crea lobby, join lobby, profilo), in che punto si trova l’utente e qual è **l’unico prossimo passo** visibile.
- **Stati di guida**: primo uso (coach mark), vuoto con CTA, caricamento, successo, errore con recovery. Vanno elencati nel ticket, non improvvisati in implementazione.
- **Motion funzionale**: quali transizioni indicano il passo (cambio step, highlight del prossimo controllo, success pop) e quali sono escluse. Riferimento: [patterns/onboarding.md](patterns/onboarding.md) e [tokens.md#motion-per-onboarding](tokens.md#motion-per-onboarding).
- Output: ticket GitHub con descrizione e criteri di accettazione.

### 2. References

- Raccogli screenshot di app simili, mappe, componenti esistenti.
- Limita a 3-5 riferimenti per non disperdersi.
- Annota cosa prendere e cosa scartare.

### 3. Prototype

- Prototipo HTML statico con i token veri (`app/globals.css`).
- Figma o carta servono solo per schizzare: non sono fonte di verità.
- Mobile 360px prima di tutto.
- Indica token, stati e touch target.

### 4. Design review

- @designer confronta il prototipo con il design system.
- Controlla: token, contrasto, stati, motion, accessibilità.
- Output: approvazione o lista di aggiustamenti.

### 5. Implementazione

- @designer scrive il codice UI.
- Usa componenti esistenti; se serve una nuova variante, aggiorna la docs.
- Non introdurre colori hardcoded.
- Non attivare il tema scuro se non è il task concordato.

### 6. Review tecnica

- @oracle controlla correttezza, test, regressioni, coerenza con il design system.

### 7. Verifica live

- @tester avvia il dev server.
- Controlla: 360px e desktop, dark (unico tema), reload, toggle stati, console/hydration error, screenshot.

### 8. Ship

- `npm run test:all` verde, incluso `npm run lint:design`.
- Merge solo dopo approvazione @designer + @oracle + @tester.

## Ruoli

| Ruolo | Responsabilità |
|---|---|
| @designer | Prototipo, implementazione UI, coerenza visiva, token, accessibilità. |
| @fixer | Logica non-UI, test unitari, rispetto dei vincoli. |
| @oracle | Code review, architettura, prevenzione regressioni. |
| @tester | Verifica runtime su device/emulatore, screenshot, console. |

## Gate

- `npm run lint:design` verde.
- `npm run test:visual` verde in locale e in CI (baseline `/styleguide` a 360/768/1280). I font sono locali (`app/fonts/`, serviti da `next/font/local`): nessun fetch a runtime, rendering deterministico tra locale e runner.
- `npm run test:a11y` verde (axe su `/styleguide`, `/~offline`, `/submit-court`).
- Contrasto AA verificato sui nuovi token/sfondi.
- Touch target 44px su ogni nuovo elemento interattivo.
- Tutti gli stati (default/hover/active/focus/disabled) definiti.
- La schermata dichiara pipeline, passo e stati di guida ([patterns/onboarding.md](patterns/onboarding.md)); una sola CTA primaria.
- Visual regression Playwright a 360/768/1280.
- axe-core senza violazioni nuove.
- Link a [COMPONENTS.md](COMPONENTS.md), [gaps.md](gaps.md) e [specs/](specs/) aggiornati se il task tocca componenti, eccezioni o schermate.
- Verifica live @tester completata.

## Cosa NON fare

- Aggiungere un tema scuro se non è il task assegnato.
- Cambiare font o palette senza ADR.
- Scrivere codice UI senza passare dalla review @designer.
- Saltare la verifica live con “build passa”.
- Aggiungere token non usati (YAGNI).
