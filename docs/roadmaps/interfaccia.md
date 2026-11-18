# Interfaccia

**Orizzonte**: primavera.
**Obiettivo**: la mappa resta il navigatore principale, e la lista delle partite le sta **sopra** invece che accanto.
**Piano**: nessuno ancora — il prototipo è approvato, l'implementazione va pianificata.

## Stato

Il design system 1.5 è chiuso (d1–d27). Il prototipo della navigazione mappa/lobby è stato approvato il 2026-11-17 e verificato 27/27 su WebKit: foglio con tre snap sopra la mappa, handle cliccabile, handoff scroll↔drag.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Foglio mappa/lobby dal prototipo approvato | #89 | prototipo B approvato in via di principio, implementazione sospesa fino a #90, poi prima di #95 |
| Focus trap e contrasto runtime dei componenti nuovi | #29 | aperto |
| Onboarding multi-step per la scelta dello sport | #45 | aperto, decisione di prodotto mancante |

## Decisioni chiuse

- **#89 dopo #90, prima di #95 (deciso 2026-11-18)**: implementazione sospesa fino alle Note di campo (#90), poi prima di aprire ai tester (#95), insieme alla rifinitura della home per la beta.

- **Niente swipe orizzontale**: il pan della mappa è lo stesso gesto, e a 360px non esiste una zona bordo che non rubi drag.
- Il foglio ha tre snap e un handle da 44px che cicla gli stati: funziona anche senza drag.
- La home **diventa** il foglio, non una seconda pagina.
- Ogni modifica UI mobile passa dal giro Safari/iPhone: `npm run test:ios` o `npm run verify:webkit` per i prototipi.

## Decisioni aperte

Nessuna.

## Nota

Il design system è un vincolo, non una lane: `docs/design/` si aggiorna quando il codice diverge, e ogni modifica passa da @designer più verifica live.
