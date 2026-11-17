# Core loop

**Orizzonte**: primavera.
**Obiettivo**: dichiarare una serie **una volta** deve bastare perché la serata esista, senza che nessuno la ricrei o la riannunci.
**Piano**: `docs/plans/spring.md`, voci 3, 4, 12.

## Stato

Il ciclo base è maturo: lobby, partecipanti, realtime, chiusura automatica, karma. Quello che manca non sono oggetti nuovi — l'**occorrenza** è già la lobby e la **Conferma** è già `lobby_participants` — ma la regola di ripetizione e la semantica delle occorrenze future.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Occorrenze e karma: riconferma, check-in per partita, occorrenze future fuori dalle liste | #91 | aperto, analisi completa nel commento |
| Appuntamento ricorrente: serie, generatore, opzione ripetibile | #92 | aperto, bloccato da #91 |
| Durata della partita e doppioni sul campo | #96 | aperto |

## Decisioni chiuse

- La Conferma a distanza **non è punibile**. A ridosso si chiede una **Riconferma**; chi non riconferma esce senza penale. Il -3 scatta solo per chi ha riconfermato e non si presenta.
- Il check-in si lega alla **partita**, e la partita la decide il server, mai il client.
- La durata è un dato (`duration_minutes`); l'uscita della singola persona è il **check-out**, non un orario dichiarato.
- I doppioni non si fondono: si **prevengono alla creazione**.

## Decisioni aperte

- **Autorità sulle serie**: raccomandato "chi ha confermato può gestire le occorrenze" (`created_by` solo come provenienza). Non confermato.
- Soglie: quante ore prima parte la finestra di riconferma (raccomandato 24h → 30min) e quanto "vicino" è vicino nelle liste (raccomandato 36h).

## Dipendenze

#91 prima di #92, in quest'ordine e mai il contrario: generare le occorrenze prima di sistemare la penalità significa punire chiunque abbia confermato. Rilascio in quattro migrazioni, con la quarta (cambio predicato karma) mai prima della seconda (valorizzazione di `lobby_id`).
