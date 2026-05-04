## ADDED Requirements

### Requirement: Check-in GPS
Il sistema DEVE permettere all'utente di effettuare il check-in su un campo solo se la sua posizione GPS è all'interno di un raggio definito dal campo.

#### Scenario: Check-in valido
- **WHEN** l'utente preme "Check-in" e il suo GPS riporta una distanza inferiore a 50 metri dal campo con accuratezza del segnale <= 20 metri
- **THEN** il sistema registra il check-in e aggiorna la lobby del campo

#### Scenario: Check-in non valido (troppo lontano)
- **WHEN** l'utente preme "Check-in" e il suo GPS riporta una distanza superiore a 50 metri dal campo
- **THEN** il sistema rifiuta il check-in e mostra un messaggio di errore

#### Scenario: Check-in con GPS scarso
- **WHEN** l'utente preme "Check-in" con accuratezza del segnale superiore a 20 metri
- **THEN** il sistema mostra un avviso che chiede di spostarsi verso il centro del campo per migliorare il segnale

### Requirement: Stato presenza in tempo reale
Il sistema DEVE aggiornare in tempo reale il numero di giocatori presenti su un campo dopo ogni check-in.

#### Scenario: Aggiornamento contatore giocatori
- **WHEN** un utente effettua il check-in con successo
- **THEN** il contatore dei giocatori presenti sul campo viene incrementato e visualizzato in tempo reale agli altri utenti

### Requirement: Checkout automatico
Il sistema DEVE rimuovere automaticamente un utente dalla lista dei presenti dopo **2 ore** dal suo ultimo check-in o attività, se non ha effettuato il checkout manuale.

#### Scenario: Checkout manuale
- **WHEN** l'utente preme il pulsante "Lascio il campo"
- **THEN** il sistema lo rimuove dalla lista dei presenti sul campo
