# Dati e territorio

**Orizzonte**: primavera, poi attività ricorrente.
**Obiettivo**: la mappa deve essere **vera e riconoscibile** nel polo di partenza. Un campo che non puoi nominare non è un campo, è una coordinata.
**Piano**: `docs/plans/spring.md`, voci 1, 1b, 2.

## Stato

Il database ha 10.130 campi su Roma, ma: **6.364 non hanno sport** (63%), **9.572 sono chiamati "Spazio aperto"** e solo 51 hanno un indirizzo. `beachvolleyball` è nei dati e non nell'app. Ostia è fuori dal bbox. Non è un difetto dello script: in OpenStreetMap quei campi non hanno nome.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Sbloccare gli slug di sport che i dati già contengono | — | da aprire |
| Audit `sport` limitato al bbox del polo | #63 | aperto, scope ridotto |
| Note di campo (agibilità leggera) | #90 | aperto |
| Nominare i campi del polo | #106 | deciso 2026-11-18, non ancora implementato |
| Estrazione OSM del secondo polo (Ostia) | — | rinviato |
| Curatela ricorrente delle aggiunte future | — | attività, non ticket |

## Decisioni chiuse

- Il polo di partenza è **Roma70 a EUR**, già dentro il bbox: nessuna estrazione nuova per partire.
- L'agibilità si esprime con **Note datate**, mai con uno stato binario, e il campo non viene mai nascosto né bloccato.
- L'audit dei campi si fa sul polo, non su Roma intera.
- **Nomi dei campi (deciso 2026-11-18, #106, non ancora implementato)**: nome generico con flag di generazione automatica; l'utente interessato propone un nome che passa da coda di moderazione (Andrea o altri moderatori); serve UI per proporre e per rivedere.

## Decisioni aperte

Nessuna.

## Dipendenze

Nessuna tecnica. Per Ostia serve la decisione di aprire il secondo polo, e a quel punto l'estrazione è un pomeriggio.

## Perché conta

Un database di campi **verificati, nominati e giocabili** è l'unica cosa che i concorrenti romani non hanno e non copiano in un trimestre. È anche l'unica voce che rende l'azienda vendibile. Costa noia, non ingegno.
