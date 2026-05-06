## ADDED Requirements

### Requirement: Segnalazione stato campo
Il sistema DEVE permettere agli utenti autenticati di inviare segnalazioni sullo stato fisico di un campo.

#### Scenario: Invio segnalazione
- **WHEN** l'utente seleziona un campo e sceglie "Segnala problema"
- **THEN** il sistema registra la segnalazione con categoria, descrizione e timestamp

### Requirement: Categorie segnalazione
Il sistema DEVE supportare almeno le seguenti categorie di segnalazione: "Canestro rotto", "Campo bagnato", "Illuminazione non funzionante", "Campo occupato", "Altro".

#### Scenario: Selezione categoria
- **WHEN** l'utente crea una segnalazione
- **THEN** il sistema obbliga la selezione di una delle categorie predefinite

### Requirement: Visualizzazione segnalazioni
Il sistema DEVE mostrare le segnalazioni recenti (ultime 24 ore) nella scheda dettaglio di un campo.

#### Scenario: Lettura segnalazioni
- **WHEN** un utente apre il dettaglio di un campo
- **THEN** il sistema mostra un avviso se esistono segnalazioni aperte nelle ultime 24 ore

### Requirement: Rimozione segnalazione obsoleta
Il sistema DEVE rimuovere o archiviare automaticamente le segnalazioni più vecchie di 48 ore.

#### Scenario: Scadenza segnalazione
- **WHEN** una segnalazione raggiunge le 48 ore di età
- **THEN** il sistema la marca come obsoleta e non la mostra più come attiva
