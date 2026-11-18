# Piano primavera

Stato: **bozza approvata a voce il 16 novembre 2026**, in attesa di due decisioni (vedi *Decisioni aperte*).
Obiettivo: aprire una beta chiusa con utenti reali a Roma entro la primavera 2027, quando si torna a giocare all'aperto, e **arrivare all'estate con ricavi già attivi** (ideale: dalla primavera stessa). I ricavi sono parte del traguardo, non un contorno: questo ha una conseguenza aritmetica scritta nella voce 13.

## Premessa

Il core loop esiste già ed è maturo: mappa dei campi, check-in, lobby, karma, moderazione, profilo, recensioni, onboarding, outbox offline. `docs/roadmap.md` e `.wayfinder/MAP.md` sono indietro rispetto al codice e vanno letti con sospetto.

La posizione scelta è **infrastruttura leggera per chi organizza**: non si compete frontalmente con Pick-Roll (≈50k attivi dichiarati a Roma, stesso concept dal 2016), si occupa invece il posto che loro non coprono — il calendario pubblico degli sport all'aperto, dove il contenuto lo producono i gruppi che già giocano.

Il vincolo economico è reale: free tier Vercel + Supabase condiviso con stage, nessun ricavo prima dei primi accordi locali.

## Non-obiettivi (espliciti)

Follower, feed, messaggi diretti, chat fuori dalla lobby, traduzioni, analytics di terze parti, classifiche globali, tornei con iscrizioni, copertura di Roma intera, prenotazione di impianti.

## Le voci

### 1. I campi del polo di partenza
Il bbox dei 10.130 campi è lat 41.749–41.981, lon 12.300–12.656: **Ostia è fuori** (41.73 / 12.28), quindi a Pietro Rosa la mappa è vuota. Inoltre `beachvolleyball` e altri slug presenti nei dati non sono accettati dalla whitelist di `nearby_courts` (mig. 011) e non esistono in `lib/sport/sports.ts`: 17 campi di beach volley sono invisibili.

*Lavoro*: rilancio di `scripts/extract_osm.py` sul bbox del polo, reseed, sblocco degli slug mancanti.
*Fatto quando*: aprendo l'app su Ostia si vedono i campi, e il filtro "pallavolo"/"beach volley" li trova.

In più, **curatela manuale**: il pacchetto dati OSM contiene campi che non sono agibili. Va previsto un tempo ricorrente per rivedere le aggiunte future e correggere quelle sbagliate, non un intervento una tantum.

### 1b. Note di campo (agibilità)
Un campo può esistere in mappa e non essere utilizzabile: canestro rotto, cancello chiuso, area diventata parcheggio, illuminazione assente.

*Decisione*: **nessuno stato binario "agibile / non agibile"** — il verdetto invecchia e diventa falso. Si usano **Note**, ognuna con tipo, data e autore, mostrate con la loro età ("2 settimane fa"). Il campo **non viene mai nascosto né bloccato**: le note si vedono e l'uso resta a discrezione di chi va a giocare. Inserimento riservato all'admin per ora; segnalazioni utente dopo la beta, riusando la coda di moderazione.

*Fatto quando*: dalla scheda di un campo si vedono le note con la data, e un campo con una nota recente resta visibile sulla mappa.

### 2. I campi senza sport
6.364 campi su 10.130 hanno `sport = null` (63%). Il filtro sport risponde su un terzo del database. Esiste #63 (audit in 203 blocchi manuali, 1 fatto).

*Lavoro*: audit **limitato al bbox del polo**, non ai 10.130.
*Fatto quando*: nel polo, ogni campo visibile ha uno sport che il filtro riconosce.

**Il problema che viene prima dell'audit**: **9.572 Campi su 10.130 si chiamano letteralmente "Spazio aperto"**, solo 526 hanno un nome distinto e 51 hanno un indirizzo. Non è un difetto dello script (`scripts/extract_osm.py` legge `name` e `addr:street`), è che in OSM quei campi non hanno nome. Conseguenza: nessuno può riconoscere un Campo, né dire "ci vediamo al tal posto", né curarne l'agibilità senza prima identificarlo. Il database è anonimo, e un database anonimo non è un asset.

*Opzioni*: far nominare i Campi agli utenti con moderazione (economico, ma richiede utenti); incrociare con il censimento comunale degli impianti; oppure nominarli a mano per satellite sul solo polo. Da decidere quando si apre il ticket dei dati.

### 3. Appuntamento ricorrente
Una lobby oggi è una partita singola (`court_id`, `start_time`, `max_players`, `status`). Chi organizza deve rifarla e riannunciarla ogni settimana.

*Lavoro*: `lobby_series` (campo, giorno della settimana, ora, sport, capienza, attiva) + `lobbies.series_id` + unique `(series_id, start_time)` + generatore delle occorrenze. Nella creazione partita, l'opzione "ripetibile".
*Fatto quando*: dichiarare una serie una volta produce da sola le partite delle settimane successive, e le partite restano identiche a oggi.

### 4. Le occorrenze future e il karma
La parte delicata. Oggi `decrement_karma_on_missed_check_in` (mig. 027) penalizza a ogni chiusura chi non ha check-in, e confronta per `court_id`, non per partita. `check_ins.lobby_id` è **sempre NULL** perché il client non lo passa. `auto_close_lobbies` chiude a +30 min senza distinguere le occorrenze future, che restano `open` e saturano `open_lobbies` (tetto 100, ordinate per orario).

*Regola decisa*:

- La **Conferma** (iscrizione) è libera e non punibile a distanza.
- A ridosso dell'occorrenza si chiede una **Riconferma**. Chi non riconferma si considera fuori: **nessuna penalità**.
- La penalità (-3) scatta solo se hai riconfermato e non ti presenti.
- Il check-in va legato alla partita, non al campo.
- Le occorrenze future non devono comparire nella lista delle partite vicine.

*Fatto quando*: con tre serie attive, nessuno perde karma per una partita di un mese dopo, e la lista "vicine" mostra solo ciò che è vicino nel tempo.

*Stato (2026-11-18)*: **fatta** in `037`-`039` più il client (`lib/lobby/phase.ts`), ticket #91 chiuso. Due scostamenti dalla meccanica raccomandata, entrambi deliberati dopo la review: il -3 guarda la **presenza** (check-in sulla corte dentro `[inizio - 2h, fine]`), non lo stato `active`, perché il checkout a 2 ore avrebbe penalizzato chi era stato lì; e la quarta migrazione non è servita — predicato nuovo e rimozione di `in_progress` sono nella stessa, con un ordine che resta "mai prima di `lobby_id` valorizzato". Generazione delle serie (14 giorni) e capienza restano di #92.

*Meccanica raccomandata (@oracle, commento su #91)*: cron notturno con orizzonte mobile di 14 giorni (mai generazione lazy: la RLS INSERT impone auth e due lettori duplicherebbero); filtro `start_time < now() + interval '36h'` dentro `open_lobbies` e nella query "vicine", più indice parziale su `(status, start_time)`; `reconfirmed_at timestamptz NULL` su `lobby_participants` con finestra `start_time - 24h … start_time - 30min`; `lobby_id` del check-in assegnato da un `BEFORE INSERT` che cerca la lobby riconfermata sulla stessa corte (mai dal client); capienza con trigger e `FOR UPDATE` (un CHECK non può contare righe); `starting_soon` filtrata sui riconfermati.

Rilascio in quattro migrazioni: **M1** filtri di lettura e indice, **M2** riconferma e auto-`lobby_id`, **M3** serie, capienza e policy DELETE, **M4** cambio del predicato karma. **Mai M4 prima di M2**: applicherebbe il predicato nuovo a dati con `lobby_id` ancora NULL.

Nota emersa dall'analisi: le migrazioni 002→007 hanno spostato **di proposito** il confronto da `lobby_id` a `court_id` proprio perché il campo era sempre NULL, e i commenti della 027 dichiarano il predicato vecchio. Il NULL è stato stabile, non un bug: nessun backfill.

### 5. Ricorrenza abituale (opzionale, non gate)
Stima dedotta dallo storico dei check-in su campo + giorno + ora. Mostrata come stima ("di solito qui il giovedì ci sono sei"), mai come presenza; solo dopo soglie minime (≥4 settimane, ≥3 persone diverse) e solo con consenso a rendere visibile il proprio storico; un tap la trasforma in Conferma.

Non è un requisito per aprire: si costruisce quando ci sono i dati per alimentarla, altrimenti non c'è niente da mostrare.

### 6. Fiducia: valutazioni e chat
- **Chat effimera dentro la lobby**, muore 24 ore dopo la partita.
- **Valutazione** solo post-partita e solo tra chi ha giocato: la co-presenza è calcolata dal sistema, senza conferme esplicite degli utenti. Chi non c'era non può votare, quindi il bombing su una singola persona non è un problema di moderazione ma di autorizzazione.
- **Reputazione** mostrata per sport, distinta dal Karma.
- **Link Instagram** sul profilo al posto di un grafo sociale interno.

### 7. Notifiche
Le push esistono come codice e non sono attive (#87: chiavi, secrets, cron). Sono l'unico canale di riattivazione della beta.

*Lavoro*: attivazione, due soli eventi ("si è formata una partita vicino a te", "stasera al campo X ci sono sei"), più un **audit delle notifiche esistenti** — quante sono, quali si sovrappongono, quali sono inutili. Regola per il futuro: ogni feature nuova dichiara le notifiche che introduce, altrimenti la produzione esplode con le occorrenze.

### 8. Carta e GDPR — diviso in due
- **8a, codice, presto**: eliminazione account e export dati. Vanno prima dei tester perché toccano schema, cascade e storage (avatar): non si aggiungono a fine progetto.
- **8b, testi legali, tardi**: privacy, termini, cookie (oggi `[DA COMPILARE]`). Possono essere scritti a ridosso dell'apertura.

*Vincolo*: **nessun utente esterno prima di 8a**.

### 9. Backup verificato
Backup di stage con **restore provato almeno una volta**. Senza, un comando sbagliato azzera campi e dati dei tester in modo irreversibile.

### 10. Beta a inviti
Registrazione pubblica disattivata, utenti creati con `inviteUserByEmail` (nessuna tabella nuova). 20-30 persone reclutate a mano, tre volte a settimana sul campo.

*Prerequisiti*: **SMTP dedicato (#86)** — con l'SMTP di default di Supabase le email di invito verso indirizzi esterni non arrivano, e la beta non parte proprio. E l'istruzione "**installa la PWA**" (#80): su iOS Safari nel browser la posizione non arriva e il check-in non funziona, quindi metà delle segnalazioni dei tester sarebbe "non funziona".

Quattro numeri, una volta a settimana: partite create, conferme per partita, check-in, ritorno a 7 giorni.

### 11. La parte che non è tecnologia
- P.IVA quando arrivano i primi ricavi (forfettario, 5% i primi cinque anni).
- Due o tre conversazioni con organizzatori o sponsor di quartiere entro marzo.
- Ricavi attesi realistici nei primi dodici mesi: 1-4 k€ (sponsor locali 300-1.500 € × 2-4, quote torneo). Nessun precedente di comuni o federazioni che paghino per dati d'uso.

### 12. Finestra temporale e doppioni sullo stesso campo
Oggi "si chiude alle" è `start_time + 30 minuti`, e `auto_close_lobbies` chiude a +30. Va bene per un pick-up di basket, è sbagliato per una partita di pallavolo, che dura un'ora. Inoltre due lobby sullo stesso campo e alla stessa ora sono, nella realtà, **un solo ritrovo**: la gente arriva quando può e va via quando deve.

*Decisione*: `duration_minutes` sulla lobby (default 30; volley e padel 90, calcetto 60) usata per la chiusura automatica e per l'orario mostrato. L'**uscita individuale** non è un orario dichiarato: è il check-out, che esiste già. I doppioni non si fondono — si **prevengono alla creazione**: se sul campo c'è già una lobby sovrapposta, la creazione avverte e propone di unirsi.

*Fatto quando*: una partita di volley non risulta chiusa mentre si gioca, e non esistono due lobby sovrapposte sulla stessa corte senza che l'autore lo abbia saputo.

*Stato (2026-11-18)*: **fatta** in `036` (durata, `ends_at` generata, chiusura su `ends_at`, `open_lobbies`) e nel drawer (sport, durata, avviso con Unisciti/Crea comunque). Ticket #96 chiuso. Le durate per sport vivono in `lib/sport/sports.ts`, non in un CHECK: si ritoccano con i dati della beta.

### 13. Crescita: da venti a qualche centinaio in un polo
I ricavi sono un traguardo d'estate, quindi vanno scritti i numeri che li rendono possibili. **Nessuno sponsorizza venti persone**: uno sponsor di quartiere compra appartenenza in una community visibile, e la soglia realistica è qualche centinaio di attivi **nello stesso polo**. Il ricavo non è una funzione del codice ma della densità.

*Conseguenza*: la beta non deve solo aprire, deve **crescere**; le conversazioni con sponsor e organizzatori iniziano adesso, non a marzo; e il criterio di lettura è la densità per polo, non il totale degli iscritti.

*Fatto quando*: esiste un polo con almeno ~200 attivi e 3-5 serie che girano, e almeno una conversazione commerciale iniziata.

## Ordine di esecuzione

Le cose che non si possono aggiungere dopo vengono prima.

1. **8a** (codice GDPR) e **9** (backup verificato) — prima che entri chiunque.
2. **1** e **2** (dati del polo) — la mappa deve esistere prima che si possa giocarci.
3. **4** (semantica delle occorrenze) e **12** (finestra e doppioni) insieme: sono entrambe correzioni del core loop, e vanno prima del generatore. Dipendono dalla raccomandazione di @oracle.
4. **3** (generatore), poi **6** (fiducia), poi **7** (push).
5. **10** (beta) e **8b** in parallelo. **13** (crescita) non è una fase: corre da subito.
6. **5** (ricorrenza abituale) solo dopo quattro settimane di dati reali.

## Rischi

- **Karma**: un errore nella voce 4 brucia la fiducia degli utenti nel primo mese ed è irreversibile.
- **Densità**: dipende interamente dagli organizzatori arruolati. Se non ne entra nemmeno uno, la mappa resta vuota qualunque cosa dica il codice.
- **Scope**: le funzioni social sono la tentazione ricorrente e sono tutte fuori perimetro.
- **Documentazione stale**: roadmap e Wayfinder vanno riconciliati col codice prima di pianificare qualunque cosa.
- **Costi**: free tier condiviso; ogni utente in più è un costo non controllato.
- **Email**: senza SMTP dedicato (#86) gli inviti della beta non vengono consegnati, e la voce 10 non è nemmeno collaudabile.
- **iOS**: nel browser Safari la geolocalizzazione non arriva (#80). Il check-in funziona solo con la PWA installata: va detto ai tester, altrimenti le segnalazioni saranno rumore.

## Decisioni aperte

- **Navigazione mappa/lobby**: issue #89. La scelta (pannello trascinabile vs due tab) si prende alla review del prototipo, come impone `docs/design/1.5.md`; non blocca nulla.

## Ticket

| Voce | Ticket |
| --- | --- |
| 1 · campi del polo, slug sport | nuovo, da aprire |
| 1b · Note di campo | #90 |
| 2 · audit sport nel polo | #63 (scope ridotto, commentato) |
| 3 · Appuntamento ricorrente | #92 |
| 4 · Occorrenze e karma | #91 (blocca #92) |
| 5 · Ricorrenza abituale | da aprire quando ci sono i dati |
| 6 · Fiducia: valutazioni e chat | #93 |
| 7 · Push e audit notifiche | #87 (commentato) |
| 8a · GDPR nel codice | #94 (metà codice di #83) |
| 8b · Testi legali | #83 |
| 9 · Backup verificato | #85 (scope ridotto, commentato) |
| 10 · Beta a inviti | #95 (bloccata da #86) |
| 11 · P.IVA e conversazioni | fuori dal tracker |
| 12 · Finestra temporale e doppioni | #96 |
| 13 · Crescita nel polo | non è codice |

## Prerequisiti che non sono voci del piano

- **#86 SMTP dedicato** — senza, gli inviti della beta non vengono consegnati e la voce 10 non è collaudabile.
- **#80 geolocalizzazione iOS** — il check-in funziona solo con la PWA installata; va comunicato ai tester.
- **#84 rate limit e moderazione foto** — con utenti esterni e valutazioni, prima o poi morde.

