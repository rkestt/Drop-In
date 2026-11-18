# Core loop

**Orizzonte**: primavera.
**Obiettivo**: dichiarare una serie **una volta** deve bastare perché la serata esista, senza che nessuno la ricrei o la riannunci.
**Piano**: `docs/plans/spring.md`, voci 3, 4, 12.

## Stato

Il ciclo base è maturo: lobby, partecipanti, realtime, chiusura automatica, karma. Quello che manca non sono oggetti nuovi — l'**occorrenza** è già la lobby e la **Conferma** è già `lobby_participants` — ma la regola di ripetizione e la semantica delle occorrenze future.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Occorrenze e karma: riconferma, check-in per partita, occorrenze future fuori dalle liste | #91 | **fatto** 2026-11-18 — migrazioni 037-039, client `lib/lobby/phase.ts`, gate verde |
| Appuntamento ricorrente: serie, generatore, opzione ripetibile | #92 | aperto, **sbloccato** da #91; orizzonte 14 giorni già deciso |
| Durata della partita e doppioni sul campo | #96 | **fatto** 2026-11-18 — migrazione 036, `duration_minutes` + `ends_at`, avviso doppioni nel drawer |

## Decisioni chiuse

- La Conferma a distanza **non è punibile**. A ridosso si chiede una **Riconferma**; chi non riconferma esce senza penale. Il -3 scatta solo per chi ha riconfermato e non si presenta.
- Il check-in si lega alla **partita**, e la partita la decide il server, mai il client.
- La durata è un dato (`duration_minutes`); l'uscita della singola persona è il **check-out**, non un orario dichiarato.
- I doppioni non si fondono: si **prevengono alla creazione**.
- **Soglie confermate** (2026-11-18): finestra di Riconferma 24h → 30 min prima; orizzonte "Vicine" 36h; orizzonte di generazione delle serie 14 giorni (quest'ultimo vale per #92).
- Il -3 guarda la **presenza, non lo stato del check-in**: chi ha timbrato sulla stessa corte dentro `[inizio - 2h, fine]` non è punibile, anche se poi è uscito o se l'auto-checkout l'ha chiuso. Il check-in si aggancia anche a una riconferma arrivata **dopo** il timbro (backfill), altrimenti chi timbra presto risulterebbe assente.
- `status = 'in_progress'` **eliminato**: nessuno lo scriveva; "in corso" si deriva da `start_time`/`ends_at` (`lib/lobby/phase.ts`).

## Decisioni aperte

- **Autorità sulle serie**: raccomandato "chi ha confermato può gestire le occorrenze" (`created_by` solo come provenienza). Non confermato — è l'unica decisione che blocca #92.

## Dipendenze

#91 prima di #92, in quest'ordine e mai il contrario: generare le occorrenze prima di sistemare la penalità significa punire chiunque abbia confermato. Il rilascio è avvenuto in **tre** migrazioni invece di quattro — `037` (riconferma, aggancio del check-in, orizzonte 36h), `038` (predicato del -3 e rimozione di `in_progress`), `039` (correzioni dopo la review: backfill alla riconferma, presenza al posto dello stato, aggancio da -2h). L'ordine è stato rispettato: il predicato nuovo è atterrato dopo che `lobby_id` veniva popolato.
