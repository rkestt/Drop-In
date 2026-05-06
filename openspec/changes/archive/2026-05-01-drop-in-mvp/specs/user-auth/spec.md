## ADDED Requirements

### Requirement: Registrazione utente
Il sistema DEVE permettere agli utenti di registrarsi tramite email e password o tramite Google OAuth.

#### Scenario: Registrazione email
- **WHEN** l'utente inserisce email e password valide
- **THEN** il sistema crea un account e invia un'email di conferma

#### Scenario: Registrazione Google
- **WHEN** l'utente sceglie di registrarsi con Google
- **THEN** il sistema crea un account collegato al provider Google

### Requirement: Autenticazione
Il sistema DEVE permettere agli utenti registrati di accedere all'applicazione.

#### Scenario: Login
- **WHEN** l'utente inserisce le credenziali corrette
- **THEN** il sistema autentica l'utente e lo reindirizza alla dashboard

### Requirement: Profilo utente
Il sistema DEVE mantenere un profilo utente con almeno: nickname, avatar (opzionale), Karma Score, storico partite.

#### Scenario: Aggiornamento profilo
- **WHEN** l'utente modifica il proprio nickname
- **THEN** il sistema salva il nuovo nickname e lo propaga alle lobby attive

### Requirement: Sessione persistente
Il sistema DEVE mantenere la sessione utente attiva tramite token JWT fino alla disconnessione esplicita.

#### Scenario: Ritorno all'app
- **WHEN** l'utente riapre la PWA dopo averla chiusa
- **THEN** il sistema recupera la sessione attiva senza richiedere nuovamente il login
