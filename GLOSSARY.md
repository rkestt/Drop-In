# Drop-In

App per trovare campetti sportivi pubblici all'aperto, dichiarare di star giocando e trovare con chi giocare. Il dominio ruota attorno a una sola domanda: *chi sta giocando, dove, adesso*.

## Presenza

**Presenza**:
Chi sta giocando, su quale campo, in questo momento. È la promessa principale del prodotto e la cosa che l'app deve saper dire prima di ogni altra.
_Avoid_: attività, feed, "chi c'è online"

**Check-in**:
Dichiarazione di un Utente di essere su un Campo in questo momento. È effimera: si apre e si chiude da sola.
_Avoid_: presence ping, "segnalazione"

**Appuntamento ricorrente**:
Impegno dichiarato da un Gruppo su un Campo, un giorno della settimana e un'ora. Promette presenza futura perché qualcuno se n'è fatto carico.
_Avoid_: evento, slot, partita fissa

**Ricorrenza abituale**:
Ricorrenza dedotta dal comportamento passato su un Campo, un giorno e un'ora. È una stima, mai una promessa: si mostra come tale e non va confusa con un Appuntamento ricorrente.
_Avoid_: ghost lobby, "di solito c'è gente"

**Conferma**:
Impegno anticipato di un Utente a essere su un Campo in un momento futuro. Trasforma una Ricorrenza abituale in presenza annunciata.
_Avoid_: prenotazione, RSVP, "ci sarò"

**Riconferma**:
Conferma ripetuta a ridosso dell'occorrenza. È l'unica condizione che rende una mancata presenza punibile: chi non riconferma si considera fuori e non perde nulla.
_Avoid_: reminder, doppia conferma

## Incontro

**Incontro**:
Mettere in contatto chi cerca partita con chi ne ha già una aperta.
_Avoid_: match, matching, "connessione"

**Lobby**:
Annuncio di una partita aperta: un Campo, un orario, un numero di posti. Vive finché non si riempie o qualcuno la chiude.
_Avoid_: stanza, room, partita (la Lobby non è la partita)

**Gruppo**:
Insieme di persone che gioca insieme abitualmente.
_Avoid_: team, squadra, crew

**Club**:
Relazione duratura tra giocatori, fondata sulla conoscenza reciproca e sulla reputazione. Non è un Gruppo: un Club non ha un Campo né un orario.
_Avoid_: community, social

## Spazio

**Campo**:
Impianto sportivo all'aperto, pubblico e gratuito. Non è prenotabile: nessuno ne vende l'accesso.
_Avoid_: court, pitch, impianto, struttura

**Nota di campo**:
Annotazione datata su un problema di un Campo — canestro rotto, cancello chiuso, area privata. Non è un verdetto di agibilità: invecchia, e il Campo resta visibile.
_Avoid_: stato del campo, agibilità, "campo rotto"

## Reputazione

**Karma**:
Punteggio di affidabilità di un Utente, costruito sulle presenze mantenute e su quelle mancate.
_Avoid_: rating, punteggio, score

**Valutazione**:
Giudizio di un Utente su un altro dopo una partita a cui hanno partecipato entrambi. Esiste solo con prova di co-presenza.
_Avoid_: review, voto, feedback, "rating"

**Reputazione**:
Aggregato pubblico delle Valutazioni di un Utente, per sport. Non è il Karma: il Karma dice se si presenta, la Reputazione dice con chi si gioca.
_Avoid_: rating, stelle, "punteggio"
