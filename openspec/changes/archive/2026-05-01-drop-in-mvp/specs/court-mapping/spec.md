## ADDED Requirements

### Requirement: Visualizzazione mappa campetti
Il sistema DEVE visualizzare i campetti pubblici su una mappa interattiva all'interno della PWA.

#### Scenario: Visualizzazione iniziale mappa
- **WHEN** l'utente apre la pagina principale
- **THEN** il sistema mostra una mappa centrata sulla posizione dell'utente con i campetti nelle vicinanze

### Requirement: Dati geografici campetti
Il sistema DEVE memorizzare le coordinate geografiche (latitudine e longitudine) di ogni campo nel database.

#### Scenario: Recupero campi nelle vicinanze
- **WHEN** l'utente carica la mappa
- **THEN** il sistema recupera e mostra i campi entro un raggio di 5km dalla posizione dell'utente

### Requirement: Dettaglio campo
Il sistema DEVE permettere di visualizzare i dettagli di un campo selezionato (nome, indirizzo, tipo di superficie, numero di canestri).

#### Scenario: Apertura dettaglio campo
- **WHEN** l'utente clicca su un campo sulla mappa
- **THEN** il sistema mostra una scheda con le informazioni del campo

### Requirement: Libreria mappa
Il sistema DEVE utilizzare MapLibre GL JS per il rendering della mappa interattiva.

#### Scenario: Caricamento mappa
- **WHEN** l'utente apre la pagina principale
- **THEN** il sistema carica MapLibre con tile gratuite da OpenStreetMap

### Requirement: Popolamento dati OSM
Il sistema DEVE supportare il popolamento iniziale del database tramite script Python che interroga OpenStreetMap.

#### Scenario: Esecuzione script import
- **WHEN** l'amministratore esegue lo script di importazione
- **THEN** il database viene popolato con i campetti pubblici della zona target
