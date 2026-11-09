# 0003 — Token di motion

## Stato

Accepted

## Contesto

Durate e curve di easing erano valori ripetuti a mano nei componenti e nelle
keyframe (`0.4s cubic-bezier(0.25, 1, 0.5, 1)`), senza un nome condiviso. La
documentazione diceva esplicitamente che tokenizzare il motion richiedeva un ADR.
Nel frattempo il pattern di onboarding assegna a ogni momento un tempo preciso:
ingresso step 250ms, uscita 200ms, press 150ms, pop di conferma 350–500ms.

## Decisione

- Le durate vivono in `:root` in `app/globals.css`: `--motion-fast: 150ms`,
  `--motion-base: 200ms`, `--motion-slow: 250ms`, `--motion-success: 400ms`.
- Le curve vivono in `@theme`: `--ease-standard: cubic-bezier(0.25, 1, 0.5, 1)` e
  `--ease-elastic: cubic-bezier(0.34, 1.56, 0.64, 1)`. Tailwind v4 ha un namespace
  `--ease-*` e genera `ease-standard` / `ease-elastic`; non ha un namespace
  `--duration-*`, quindi non esiste `duration-fast` e le durate si usano con
  `var(--motion-*)` o con `duration-<ms>`.
- Le animazioni esistenti non vengono riscritte: `fadeInUp` resta 0.4s, `scaleIn`
  0.3s, `successPop` 0.5s. I token sono la scala canonica per il motion nuovo e
  per i componenti che li leggono.

## Motivazione

- Un nome invece di un numero: cambiare il ritmo dell'app diventa una modifica in
  un punto solo.
- Le durate sono quattro e bastano: press, cambio di stato, ingresso, conferma.
- Tenere le curve in `@theme` dà anche le utility, senza duplicare i valori.

## Conseguenze

- Il motion dei componenti nuovi usa i token, non i numeri.
- La styleguide legge i token dal browser: nessun valore scritto a mano.
- Migrare le classi esistenti è lavoro separato, non un prerequisito.
- `prefers-reduced-motion: reduce` continua a valere per tutto: i token non
  cambiano la regola.

## Collegamenti

- [tokens.md](../tokens.md#motion)
- [patterns/onboarding.md](../patterns/onboarding.md)
- [Styleguide](/styleguide) (solo sviluppo)
