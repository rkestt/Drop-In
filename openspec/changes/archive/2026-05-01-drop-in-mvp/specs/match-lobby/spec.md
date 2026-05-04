## ADDED Requirements

### Requirement: Creazione lobby
Il sistema DEVE permettere a un utente autenticato di creare una lobby per un campo specifico, definendo orario e numero massimo di giocatori.

#### Scenario: Creazione nuova lobby
- **WHEN** l'utente seleziona un campo e preme "Organizza partita"
- **THEN** il sistema crea una lobby visibile agli altri utenti nella zona

### Requirement: Unione a lobby
Il sistema DEVE permettere agli utenti di unirsi a una lobby esistente.

#### Scenario: Partecipazione a lobby
- **WHEN** l'utente visualizza una lobby aperta e preme "Entra"
- **THEN** il sistema aggiunge l'utente alla lista dei partecipanti

### Requirement: Limite partecipanti
Il sistema DEVE impedire l'unione a una lobby se il numero massimo di giocatori è stato raggiunto.

#### Scenario: Lobby piena
- **WHEN** l'utente tenta di unirsi a una lobby con numero partecipanti uguale al massimo
- **THEN** il sistema rifiuta la richiesta e mostra un avviso

### Requirement: Lista lobby attive
Il sistema DEVE mostrare una lista delle lobby attive entro 5km dalla posizione dell'utente.

#### Scenario: Visualizzazione lobby vicine
- **WHEN** l'utente accede alla sezione "Partite vicine"
- **THEN** il sistema elenca le lobby non ancora iniziate, ordinate per distanza

### Requirement: Chiusura lobby
Il sistema DEVE chiudere automaticamente una lobby 30 minuti dopo l'orario di inizio previsto. Il controllo è eseguito da un **job `pg_cron` + stored procedure PostgreSQL** ogni 15-30 minuti.

#### Scenario: Scadenza lobby
- **WHEN** una lobby raggiunge 30 minuti oltre l'orario di inizio
- **THEN** il sistema marca la lobby come chiusa e avvia la valutazione Karma per i partecipanti
