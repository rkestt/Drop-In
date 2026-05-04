## ADDED Requirements

### Requirement: Calcolo Karma Score
Il sistema DEVE calcolare e memorizzare un punteggio Karma per ogni utente. Il punteggio iniziale per nuovi utenti è **90**.
Il punteggio si aggiorna in base all'affidabilità (check-in effettuati vs promessi).

#### Scenario: Incremento Karma
- **WHEN** un utente effettua un check-in dopo essersi unito a una lobby
- **THEN** il suo Karma Score aumenta di 1 punto

#### Scenario: Decremento Karma per mancato check-in
- **WHEN** una lobby termina e l'utente non ha effettuato il check-in
- **THEN** il suo Karma Score diminuisce di 3 punti

### Requirement: Ban temporaneo
Il sistema DEVE impedire agli utenti con Karma Score inferiore a una soglia definita di partecipare a nuove lobby per un periodo di tempo definito.

#### Scenario: Applicazione ban
- **WHEN** il Karma Score di un utente scende sotto 50
- **THEN** l'utente non può unirsi a nuove lobby per 7 giorni

#### Scenario: Rimozione ban
- **WHEN** il periodo di ban di 7 giorni è trascorso
- **THEN** l'utente può nuovamente unirsi alle lobby, mantenendo il punteggio Karma attuale

### Requirement: Visibilità Karma
Il sistema DEVE mostrare il Karma Score dell'utente nel suo profilo pubblico (in forma anonimizzata o semplificata agli altri giocatori).

#### Scenario: Visualizzazione profilo
- **WHEN** un utente visualizza il profilo di un altro giocatore
- **THEN** il sistema mostra un indicatore di affidabilità (es. alto/medio/basso) derivato dal Karma Score
