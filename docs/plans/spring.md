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
Il bbox dei 10.130 campi è lat 41.749–41.981, lon 12.300–12.656: **Ostia è fuori** (41.73 / 12.28), quindi a Pietro Rosa la mappa è vuota. I 17 campi di beach volley invisibili per whitelist (`beachvolleyball` non canonico in `nearby_courts` mig. 011 e assente da `lib/sport/sports.ts`) sono stati sbloccati il 2026-11-18 (`be1437a`: slug canonico, `049_normalize_beach_volleyball.sql`, filtro autonomo "Beach volley").

*Lavoro*: rilancio di `scripts/extract_osm.py` sul bbox del polo, reseed.
*Fatto quando*: aprendo l'app su Ostia si vedono i campi; il filtro "beach volley" trova già i 17 campi normalizzati.

In più, **curatela manuale**: il pacchetto dati OSM contiene campi che non sono agibili. Va previsto un tempo ricorrente per rivedere le aggiunte future e correggere quelle sbagliate, non un intervento una tantum.

*Stato (2026-11-20)*: **Ostia fatta** (`f821966`) — estratto sulla fascia sud `41.700,12.200,41.749,12.660`, 1.649 righe nuove, insert puri (`ON CONFLICT (osm_id) DO NOTHING`), 194 con sport vero; il seed ora è riproducibile (prima i campi esistevano solo nel DB locale e un `db reset` li perdeva). Verificato con reset completo e col gate.

Il **reseed distruttivo** — far sparire i campi che OSM non ha più — resta non fatto e non deciso: richiede un archivio delle righe rimosse, perché la cascata porterebbe via lobby e check-in.

*Nuovo problema misurato*: a Ostia lido, entro 15 km ci sono 374 campi con sport e 2.188 elementi; `nearby_courts` ne restituisce 200 ordinati per distanza e il 200° dista **802 m**, quindi la prima schermata mostra 14 campi con sport e 186 spazi verdi. Tre strade (verdi in coda, verdi fuori dal default, niente) in #112. Non è un difetto dell'import: il seed di Roma ha 4.875 verdi su 10.130.

### 1b. Note di campo (agibilità)
Un campo può esistere in mappa e non essere utilizzabile: canestro rotto, cancello chiuso, area diventata parcheggio, illuminazione assente.

*Decisione*: **nessuno stato binario "agibile / non agibile"** — il verdetto invecchia e diventa falso. Si usano **Note**, ognuna con tipo, data e autore, mostrate con la loro età ("2 settimane fa"). Il campo **non viene mai nascosto né bloccato**: le note si vedono e l'uso resta a discrezione di chi va a giocare. Inserimento riservato all'admin per ora; segnalazioni utente dopo la beta, riusando la coda di moderazione.

*Fatto quando*: dalla scheda di un campo si vedono le note con la data, e un campo con una nota recente resta visibile sulla mappa.

*Stato (2026-11-18)*: **fatta** in `052_court_notes.sql` (tabella `court_notes`: sei tipi, testo opzionale, autore CASCADE, lettura pubblica sulle corti approvate, scritture solo via RPC moderatore) + `053_court_notes_kind_slugs.sql` (slug inglesi, tetto 200, `other` richiede il testo), ticket #90 chiuso. Client: card nella scheda con età/data e `Precedenti` oltre 30 giorni, fold a 3, form Drawer per chi modera (radio native, bottone assente dal DOM per gli altri), una riga nell'anteprima in mappa solo se fresca (la segnalazione vince lo slot); spec `docs/design/specs/note-campo.md` + prototipo `docs/design/prototypes/note-campo.html`; `test:all` verde (792 unit, `test:rls` blocchi 60a–60k, 79/79 e2e), review senza bloccanti dopo due correzioni, giro live @tester verde su 10 punti. Limite dichiarato: le segnalazioni utente arrivano dopo la beta, riusando la coda di moderazione.

### 2. I campi senza sport
6.364 campi su 10.130 hanno `sport = null` (63%). Il filtro sport risponde su un terzo del database. Esiste #63 (audit in 203 blocchi manuali, 1 fatto).

*Lavoro*: audit **limitato al bbox del polo**, non ai 10.130.
*Fatto quando*: nel polo, ogni campo visibile ha uno sport che il filtro riconosce.

**Il problema che viene prima dell'audit**: **9.572 campi su 10.130 si chiamavano letteralmente "Spazio aperto"** (backfill #106 del 2026-11-18: etichetta da tipo di impianto + flag `is_auto_name`, zero "Spazio aperto" rimasti), solo 526 avevano un nome distinto e 51 hanno un indirizzo. Non è un difetto dello script (`scripts/extract_osm.py` legge `name` e `addr:street`), è che in OSM quei campi non hanno nome. Conseguenza: nessuno può riconoscere un Campo, né dire "ci vediamo al tal posto", né curarne l'agibilità senza prima identificarlo. Il database è anonimo, e un database anonimo non è un asset.

*Opzioni decise e implementate (2026-11-18, ticket #106 chiuso)*: nome generico con flag di generazione automatica; l'utente interessato propone un nome che passa da coda di moderazione (Andrea o altri moderatori); UI per proporre e per rivedere. Dettaglio in `docs/roadmaps/dati-territorio.md`.

*Stato (2026-11-18)*: **fatta** in `050` (`courts.is_auto_name`, backfill dei 9.572 nomi generici con l'etichetta del tipo di impianto, flag esposto da `nearby_courts`/`courts_in_viewport`) + `051` (tabella proposte + quattro RPC `propose_court_name`/`withdraw_name_proposal`/`approve_name_proposal` con override/`reject_name_proposal` con nota obbligatoria, chiusura d'ufficio delle pending a campo chiuso, RLS), ticket #106 chiuso. Estrattore genera i nomi dal `venue_type` e gestisce il flag nell'upsert; client con badge "Nome automatico" + "Proponi il nome vero" su scheda e preview sheet (mai nelle righe di ricerca), form proposta, sezione "Nomi che hai proposti", terza tab "Nomi" nel pannello di moderazione; spec `docs/design/specs/nomi-campo.md` + prototipo `docs/design/prototypes/nomi-campo.html`; backfill verificato (9.572 automatici, 558 nomi veri, zero "Spazio aperto"). Resta fuori: audit `sport` sul polo (#63), Ostia e reseed del polo (voce 1). Nota di upkeep: l'import ora non reintroduce il nome generico sbagliato (flag gestito nell'upsert). Limite noto: correggere un campo che ha già un nome vero non ha una CTA, decisione a sé.

### 3. Appuntamento ricorrente
Una lobby oggi è una partita singola (`court_id`, `start_time`, `max_players`, `status`). Chi organizza deve rifarla e riannunciarla ogni settimana.

*Lavoro*: `lobby_series` (campo, giorno della settimana, ora, sport, capienza, attiva) + `lobbies.series_id` + unique `(series_id, start_time)` + generatore delle occorrenze. Nella creazione partita, l'opzione "ripetibile".
*Fatto quando*: dichiarare una serie una volta produce da sola le partite delle settimane successive, e le partite restano identiche a oggi.

*Stato (2026-11-18)*: **fatta** in `044` (`lobby_series` + `series_id` + unique) + `045` (trigger di capienza, vale per tutte le lobby) + `046` (generatore con cron notturno a 14 giorni) + `047` (materializzazione immediata alla creazione via `materialize_series`), ticket #92 chiuso. Client in `lib/series/**` con schema in `lib/validation/schemas.ts`; UI: switch "ripetibile" nel drawer, terzo tab "Serie" in `/lobbies`, chip "Ricorrente · giovedì 20:00" su card e dettaglio, sezione "Senza organizzatore" per le orfane; RLS blocchi 53–58 in `tests/rls/assertions.sql`; spec `docs/design/specs/serie.md` + prototipo `docs/design/prototypes/serie.html`. Scostamenti deliberati: le occorrenze nascono con **zero partecipanti** (nessuna Conferma implicita, quindi nessun −3 fantasma); autorità ripartita — chi ha confermato chiude la singola occorrenza, il creatore tiene regola e cancellazione, kill-switch sulle orfane per chi ha partecipato negli ultimi 28 giorni (mai su occorrenze future); generazione **silenziosa**, nessuna notifica nuova.

### 4. Le occorrenze future e il karma
La parte delicata. Oggi `decrement_karma_on_missed_check_in` (mig. 027) penalizza a ogni chiusura chi non ha check-in, e confronta per `court_id`, non per partita. `check_ins.lobby_id` è **sempre NULL** perché il client non lo passa. `auto_close_lobbies` chiude a +30 min senza distinguere le occorrenze future, che restano `open` e saturano `open_lobbies` (tetto 100, ordinate per orario).

*Regola decisa*:

- La **Conferma** (iscrizione) è libera e non punibile a distanza.
- A ridosso dell'occorrenza si chiede una **Riconferma**. Chi non riconferma si considera fuori: **nessuna penalità**.
- La penalità (-3) scatta solo se hai riconfermato e non ti presenti.
- Il check-in va legato alla partita, non al campo.
- Le occorrenze future non devono comparire nella lista delle partite vicine.

*Fatto quando*: con tre serie attive, nessuno perde karma per una partita di un mese dopo, e la lista "vicine" mostra solo ciò che è vicino nel tempo.

*Stato (2026-11-18)*: **fatta** in `037`-`039` più il client (`lib/lobby/phase.ts`), ticket #91 chiuso. Due scostamenti dalla meccanica raccomandata, entrambi deliberati dopo la review: il -3 guarda la **presenza** (check-in sulla corte dentro `[inizio - 2h, fine]`), non lo stato `active`, perché il checkout a 2 ore avrebbe penalizzato chi era stato lì; e la quarta migrazione non è servita — predicato nuovo e rimozione di `in_progress` sono nella stessa, con un ordine che resta "mai prima di `lobby_id` valorizzato". Generazione delle serie (14 giorni) e capienza sono poi atterrate in #92 (voce 3).

*Meccanica raccomandata (@oracle, commento su #91)*: cron notturno con orizzonte mobile di 14 giorni (mai generazione lazy: la RLS INSERT impone auth e due lettori duplicherebbero); filtro `start_time < now() + interval '36h'` dentro `open_lobbies` e nella query "vicine", più indice parziale su `(status, start_time)`; `reconfirmed_at timestamptz NULL` su `lobby_participants` con finestra `start_time - 24h … start_time - 30min`; `lobby_id` del check-in assegnato da un `BEFORE INSERT` che cerca la lobby riconfermata sulla stessa corte (mai dal client); capienza con trigger e `FOR UPDATE` (un CHECK non può contare righe); `starting_soon` filtrata sui riconfermati.

Rilascio in quattro migrazioni: **M1** filtri di lettura e indice, **M2** riconferma e auto-`lobby_id`, **M3** serie, capienza e policy DELETE, **M4** cambio del predicato karma. **Mai M4 prima di M2**: applicherebbe il predicato nuovo a dati con `lobby_id` ancora NULL.

Nota emersa dall'analisi: le migrazioni 002→007 hanno spostato **di proposito** il confronto da `lobby_id` a `court_id` proprio perché il campo era sempre NULL, e i commenti della 027 dichiarano il predicato vecchio. Il NULL è stato stabile, non un bug: nessun backfill.

### 5. Ricorrenza abituale (opzionale, non gate)
Stima dedotta dallo storico dei check-in su campo + giorno + ora. Mostrata come stima ("di solito qui il giovedì ci sono sei"), mai come presenza; solo dopo soglie minime (≥4 settimane, ≥3 persone diverse) e solo con consenso a rendere visibile il proprio storico; un tap la trasforma in Conferma.

Non è un requisito per aprire: si costruisce quando ci sono i dati per alimentarla, altrimenti non c'è niente da mostrare.

### 6. Fiducia: valutazioni e chat
*Schedulazione (decisa 2026-11-18)*: **dopo la voce 10 (beta)** — vedi `docs/roadmaps/fiducia-moderazione.md`.
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

*Stato (2026-11-18)*: **fatta** in `d62bc2b` (export + `creator_id` nullable) + `911bdc7` (sezione dati, fallback "Giocatore eliminato") + `3ea71e3` (delete con 409, storage prima del database, scrub notifiche) + `e3a91c0` (pre-check su `ends_at`), ticket #94 chiuso. e2e dei quattro casi (#101, `af21a0a`) e guardrail `search_path` (#102) chiusi il 2026-11-20, insieme ai quattro rami inline della route (#111, `ae3c58c`). Resta scoperto solo 8b: i testi (#83).

### 9. Backup verificato
Backup di stage con **restore provato almeno una volta**. Senza, un comando sbagliato azzera campi e dati dei tester in modo irreversibile.

*Stato (2026-11-18)*: **backup provato in locale** in `scripts/backup-db.sh` + `scripts/restore-db.sh` (`--dry-run`, produzione vietata per costruzione), ticket #85 aggiornato ma aperto. Drill eseguito: dump 1,2 MB → restore in scratch → conteggi identici (10.130 campi, 51 migrazioni, `nearby_courts` 200 righe); runbook §7 in `docs/staging.md` con comandi, RPO/RTO e checklist umana. Residuo esplicito all'umano: restore su staging cronometrato e RTO remoto. La pipeline CI/CD e la promotion delle migrazioni restano aperte: non sono questa voce.

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
4. **3** (generatore), poi **7** (push).
5. **10** (beta) e **8b** in parallelo, poi **6** (fiducia, dopo la beta). **13** (crescita) non è una fase: corre da subito.
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

- **Nessuna.** La navigazione mappa/lobby (#89, foglio a snap e ricerca nel chrome) è atterrata il 2026-11-20 in `99466d6`.

## Ticket

| Voce | Ticket |
| --- | --- |
| 1 · campi del polo (Ostia, reseed) | #112 (Ostia fatta 2026-11-20; reseed distruttivo e qualità dei dati aperti) |
| 1b · Note di campo | #90 (chiuso 2026-11-18) |
| 2 · audit sport nel polo | #63 (scope ridotto, commentato) |
| 2 · Nomi dei campi del polo | #106 (chiuso 2026-11-18) |
| 3 · Appuntamento ricorrente | #92 (chiuso 2026-11-18) |
| 4 · Occorrenze e karma | #91 (chiuso 2026-11-18, sbloccava #92) |
| 5 · Ricorrenza abituale | da aprire quando ci sono i dati |
| 6 · Fiducia: valutazioni e chat | #93 (dopo la beta, voce 10) |
| 7 · Push e audit notifiche | #87 (commentato) |
| 8a · GDPR nel codice | #94 chiuso + età minima #97 (`4522afe`) + #101/#111 |
| 8b · Testi legali | #83 |
| 9 · Backup verificato | #85 (backup provato in locale 2026-11-18, pipeline CI/CD e promotion migrazioni aperte) |
| 10 · Beta a inviti | #95 (bloccata da #86) |
| 11 · P.IVA e conversazioni | fuori dal tracker |
| 12 · Finestra temporale e doppioni | #96 |
| 13 · Crescita nel polo | non è codice |

## Prerequisiti che non sono voci del piano

- **#86 SMTP dedicato** — senza, gli inviti della beta non vengono consegnati e la voce 10 non è collaudabile.
- **#80 geolocalizzazione iOS** — il check-in funziona solo con la PWA installata; va comunicato ai tester.
- **#84 rate limit** — quote giornaliere fatte il 2026-11-20 (`b3cce32`, soglie in `rate_limit_quotas`); moderazione automatica foto e WAF restano rimandate alla beta aperta.
- **#97 età minima** — fatta il 2026-11-20 (`4522afe`): blocco secco sotto i 14, data di nascita in `profile_age`, gate dopo l'autenticazione. I testi legali vanno validati.

