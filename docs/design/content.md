# Contenuto e tono

## Voce

- Diretta, amichevole, locale.
- Italiano per tutta l’UI.
- Termini di dominio accettabili: lobby, check-in, drop-in.

## Principi

1. **Dì una cosa sola per volta**. Un bottone, un messaggio, un’etichetta.
2. **Usa il verbo all’imperativo** per le azioni: “Unisciti”, “Aggiungi”, “Filtra”.
3. **Sii concreto**: “Nessun campo da basket in quest’area” invece di “Nessun risultato trovato”.
4. **Rassicura**: gli errori spiegano cosa fare dopo.
5. **Evita gergo tecnico**: “Posizione non disponibile”, non “Geolocalizzazione fallita”.

## Microcopy comune

| Contesto | Testo |
|---|---|
| CTA primaria | Unisciti, Crea lobby, Aggiungi campo |
| CTA secondaria | Annulla, Chiudi, Filtra |
| Loading | Caricamento campi e lobby... |
| Empty lobby | Nessuna lobby attiva nelle vicinanze. Sii il primo a creare una! |
| Errore geo | Posizione non disponibile |
| Accesso | Accedi per partecipare |

## Esempi buoni vs cattivi

| Cattivo | Perché | Buono |
|---|---|---|
| “Submit” | Inglese, vago | “Aggiungi campo” |
| “Errore 500” | Tecnico, inutile | “Non riusciamo a caricare i campi. Riprova.” |
| “No results” | Inglese, impersonale | “Nessun campo da basket in quest’area” |
| “Clicca qui” | Poco accessibile, vago | “Vedi dettagli” |
| “Sei sicuro?” | Senza contesto | “Vuoi abbandonare la lobby?” |

## Formattazione

- Orari: `toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })`.
- Date: `toLocaleString("it-IT", { month: "short", day: "numeric", ... })`.
- Numeri giocatori: `3/5`, mai “3 su 5” per compattezza.
