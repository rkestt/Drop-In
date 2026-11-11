# 0002 — Mappa sempre light

## Stato

Accepted

## Contesto

La mappa è il cuore dell’app. Il provider scelto è OpenFreeMap con lo stile liberty. Il team deve decidere se la mappa debba seguire il tema dell’app o rimanere sempre chiara.

## Decisione

- La mappa è sempre nello stile light, indipendentemente dal tema dell’app.
- Anche il futuro tema scuro avrà mappa chiara.

## Motivazione

- Visibilità all’aperto: gli stili chiari si leggono meglio sotto la luce del sole.
- I marker arancioni (`--accent`) restano altamente visibili su sfondo chiaro.
- OpenFreeMap liberty è già ottimizzato per questo uso.
- Evita di dover gestire due stili di mappa, due cache tile e due set di marker.

## Conseguenze

- L’esperienza dark mode sarà “chrome scuro + mappa chiara”.
- Il contrasto tra UI scura e mappa chiara deve essere gestito con bordi/ombre appropriate.
- Gli overlay e i controlli di MapLibre devono rimanere leggibili in entrambi i casi.
- Non serve un data provider tile alternativo per il dark.

## Collegamenti

- [themes.md](../themes.md)
- [patterns/map.md](../patterns/map.md)
