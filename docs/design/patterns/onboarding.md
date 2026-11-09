# Pattern: onboarding (pipeline guidate)

Una **pipeline** è una sequenza finita di passi con un esito verificabile: l’utente sa dove è entrato, cosa gli manca e cosa succede quando finisce. Drop-In è usata in fretta e all’aperto: la pipeline non spiega l’app, porta a un risultato.

Pipeline del prodotto: **submit-court**, **check-in**, **crea lobby**, **join lobby**, **profilo/karma**. Ogni schermata appartiene a una di queste o è la mappa.

## Struttura di una pipeline

| Fase | Cosa fa | Esempio (submit-court) |
|---|---|---|
| **Ingresso** | Un solo punto di partenza riconoscibile, con il costo dichiarato | FAB “Aggiungi campo” o CTA nell’empty state |
| **Step** | Un compito per step, validazione locale, un solo controllo primario | Posizione → foto → dettagli |
| **Conferma** | Riepilogo di cosa sta per succedere + CTA che descrive l’effetto | “Pubblica campo” |
| **Uscita** | Torna al contesto di partenza e dice cosa è cambiato | Torna alla mappa, il campo è “In revisione” |

Regole:

- Massimo **4 step** prima della conferma. Oltre, la pipeline è troppo lunga: accorpa o rimanda a dopo.
- Ogni pipeline ha **un inizio, una fine e un’uscita volontaria**. Non si esce solo chiudendo l’app.
- L’ingresso dichiara il costo se non è ovvio: “3 passi”, “serve il GPS”. Mai sorprese a metà.
- L’autenticazione si chiede **all’ingresso**, non dopo che l’utente ha compilato tutto (in `app/(app)/submit-court/page.tsx` il login è già un gate d’ingresso, non uno step).
- Il deep link deve funzionare a freddo: `/submit-court` aperto da zero resta una pipeline valida, non una schermata vuota.

### Ingresso

- Un solo ingresso per pipeline, ripetuto negli stessi punti: FAB (mappa), CTA nell’empty state, CTA nella scheda campo. Stessa etichetta ovunque.
- Se l’ingresso è un’azione distruttiva o irreversibile, il testo lo dice (“Segnala”, non “Aggiungi”).
- Se manca un prerequisito (login, GPS, permesso foto), l’ingresso lo spiega **prima** di aprire la pipeline, con l’azione per risolverlo.

### Step

- **Un compito per step.** Se una schermata chiede due cose non correlate, sono due step.
- Titolo = cosa deve fare l’utente, non il nome del campo (“Scatta una foto”, non “Foto”).
- Un solo controllo primario, largo tutta la colonna. Il resto è `variant="secondary"` o testo.
- Validazione sullo step, non a ogni tasto: l’errore compare quando l’utente prova ad avanzare (`Button` disabilitato + messaggio, oppure submit con errore inline).
- Uno step può essere **condizionale** solo se è dichiarato e ha un’uscita chiara: il dedup di submit-court non è uno step, è una diramazione (“Esiste già un campo qui: è questo?”) con “Sì, è questo” / “No, è un altro”.

### Conferma

- Riepilogo di ciò che l’utente ha inserito, in sola lettura, con la possibilità di tornare indietro sullo step sbagliato (link “Modifica”, non un secondo form).
- CTA primaria con il verbo dell’effetto: “Pubblica campo”, “Conferma check-in”, “Crea lobby”. Mai “OK”, “Invia”, “Conferma” da soli.
- Conferma esplicita obbligatoria se l’azione è irreversibile o ha conseguenze sul karma (check-in, creazione lobby). Per azioni reversibili basta il bottone d’azione: non aggiungere un passo di conferma.

### Uscita

- **Successo**: torna al contesto di partenza e mostra l’esito lì (toast o banner inline con `--success`). Non una pagina “Grazie” fine a sé.
- **Errore**: resta nello step, conserva i dati, offre il recovery. Non chiudere la pipeline e non perdere l’input.
- **Uscita volontaria**: chiedi conferma solo se ci sono dati non salvati; altrimenti esci e basta.
- L’uscita dice **cosa è cambiato e cosa succede ora**: “Check-in attivo fino alle 19:40”, “Lobby creata, 3 posti liberi”.

## Un solo prossimo passo visibile

- Una schermata = **una CTA primaria**. Le altre azioni sono secondarie, ghost o testo.
- Il prossimo controllo che l’utente deve usare ha l’highlight descritto in [tokens.md](../tokens.md#motion-per-onboarding); gli altri non lo hanno.
- Non mostrare due “Avanti” (uno in fondo e uno nell’header). L’avanzamento sta dove finisce la lettura: in fondo al contenuto.
- Se servono due CTA primarie, la schermata è due step travestiti da uno: spezzala.
- La CTA secondaria non compete per colore: `variant="secondary"`, mai accent.

## Progress e stepper

- Fino a **4 step**: stepper visibile con “Passo 2 di 3” + barra o pallini. Oltre 4: la pipeline va accorciata.
- Lo stepper è **testuale e numerico**, non solo colore: `aria-current="step"` sullo step corrente, label leggibile.
- Gli step completati si possono riaprire (tornare indietro non perde i dati); gli step futuri non sono cliccabili.
- Lo stepper non è un menu: non si salta avanti.
- Nelle pipeline a **un solo passo** (check-in, join lobby) lo stepper non esiste. Non aggiungerlo per simmetria.

### Stato persistente

- Lo stato della pipeline (step corrente + dati) sopravvive a reload e chiusura app.
- Bozza in `sessionStorage`/`localStorage` con chiave esplicita (`dropin:pipeline:submit-court`); il form di submit-court lo fa già, perché aprire la fotocamera su Android può ricaricare la pagina.
- La bozza contiene **testo e posizione, non la foto**: il file resta in memoria/blob e non va serializzato in `localStorage`. Dillo all’utente quando la foto va rifatta.
- La bozza scade (24h) e all’ingresso compare “Riprendi da dove eri” / “Ricomincia”, non un ripristino silenzioso.
- Non persistere dati sensibili o posizione esatta senza consenso. La bozza si cancella all’uscita riuscita.

## Bottom sheet sequenziali vs pagina intera

| Criterio | Bottom sheet | Pagina intera |
|---|---|---|
| Campi per step | 1–3 | qualsiasi |
| Passi totali | 1–2 | 3+ |
| Contesto visibile (mappa, campo) | serve | non serve |
| Deep link o reload a metà | no | sì |
| Recupero da errore complesso (foto, GPS) | no | sì |
| Ripetizione frequente | no | sì |

- Una pipeline sta in **un solo contenitore**: o sheet o pagina, mai metà e metà.
- **Sheet sequenziali**: un sheet alla volta. Si avanza sostituendo il contenuto dello stesso sheet, non aprendone un secondo sopra.
- Il sheet non si allarga in pagina a metà flusso: se la pipeline è cresciuta, la decisione si prende a monte (o si promuove l’intera pipeline).
- Regole di contenuto e accessibilità del sheet: [sheets.md](sheets.md), [bottom-sheet.md](../components/bottom-sheet.md).

## Coach mark contestuali

- Solo alla **prima volta** per quella feature, non a ogni sessione. Flag persistito per feature (`dropin:coach:<feature>`), non un contatore globale.
- Mostrati **nel momento in cui la feature serve**, non tutti al primo avvio: il coach del check-in compare la prima volta che l’utente apre la scheda di un campo.
- Massimo **uno per schermata** e massimo 3 nel primo giorno. Un tour iniziale di 5 passi non è onboarding, è un ostacolo.
- Non coprono il controllo che spiegano: puntatore o testo accanto, il controllo resta visibile e tappabile.
- Chiusura esplicita (“Ho capito”, X, tap fuori), 44px. Una volta chiuso non torna.
- Mai coach mark per spiegare un errore: gli errori si spiegano inline dove sono.
- Se una schermata ha bisogno di un coach per essere capita, il problema è la schermata: prima semplifica, poi valuta il coach.

## Empty state che guida

- L’empty state è il **primo passo della pipeline**, non un vicolo cieco: dice cosa manca, perché, e offre la CTA che avvia.
- Struttura: icona `text-[var(--text-muted)]` 32px, titolo che descrive la situazione, una riga di spiegazione, **una** CTA primaria.
- CTA secondaria solo se serve davvero (“Aggiorna posizione”), mai per riempire.
- Copy orientato all’azione: “Nessun campo qui intorno. Aggiungi il primo.” non “Nessun risultato”.
- **Mai mostrare un empty state durante il caricamento**: skeleton o spinner finché la risposta non è arrivata, altrimenti si dice all’utente che non c’è nulla quando invece sta caricando.
- Gli empty state ricorrenti sono già previsti in [states.md](states.md); questo pattern aggiunge solo la CTA obbligatoria quando esiste una pipeline che risolve il vuoto.

## Feedback immediato

| Esito | Quando | Come |
|---|---|---|
| **Successo** | Entro 200ms dall’azione | `successPop` o `checkmarkDraw`, `--success`, testo che dice cosa è successo e cosa ora |
| **Errore** | Subito, nello step | Inline, `--danger`, causa + recovery nello stesso blocco |
| **Loading** | < 300ms niente; 300ms–1s spinner; > 1s skeleton | `Button` disabled + label in corso + `aria-busy` |
| **In corso, non bloccante** | Azione ottimistica | Stato aggiornato subito, rollback visibile se fallisce |

- Il testo del successo dice l’effetto, non “Operazione completata”: “Check-in attivo fino alle 19:40”.
- Errore di campo → inline, sotto il campo. Errore di rete o permesso → banner nello step con “Riprova”. Il toast da solo non è un recovery.
- Il loading non deve mai lasciare il bottone tappabile due volte: `disabled` durante la richiesta.
- Annunci: `role="status"` / `aria-live="polite"` per l’esito; `assertive` solo per errori bloccanti. Dettagli in [accessibility.md](../accessibility.md).

## Back, bozza, niente modali a catena

- **Back** (gesture, tasto browser, bottone) torna allo step precedente finché esistono step; solo dall’ingresso esce dalla pipeline.
- Il bottone “Indietro” è visibile nell’header, 44px: la gesture non è l’unico modo.
- Uscita con dati non salvati: **un** foglio di conferma (“Esci senza pubblicare?”) con “Continua” primaria e “Esci” destructiva. Mai due conferme in fila.
- **Niente modali a catena**: un solo livello sopra la pagina. Se serve un secondo livello, quello è un nuovo step, non un secondo modal. Un dialog dentro un dialog è sempre un errore di architettura del flusso.
- Login: se serve a metà pipeline, è un gate che riprende lo step esatto dopo l’accesso (`LoginModal` già usato come gate in submit-court); non è un secondo flusso parallelo.
- Bozza: salvataggio automatico al cambio step e al blur dei campi, indicatore discreto (“Bozza salvata”, `text-[var(--text-muted)]`), non un toast a ogni battuta.

## Esempi concreti

### Submit-court (pipeline più lunga)

- **Ingresso**: FAB “Aggiungi campo” sulla mappa, CTA nell’empty state dei campi. Deep link `/submit-court` valido.
- **Step**: 1) posizione (GPS o indirizzo) → 2) foto (opzionale ma raccomandata) → 3) nome, sport, superficie → conferma con riepilogo.
- **Diramazione dedup**: se il server trova campi vicini, si ferma la pipeline e si chiede “È questo?” con i candidati. “No, è un altro” riprende dallo step 3. Non è uno step e non si torna indietro perdendo la foto.
- **Contenitore**: pagina intera (foto, GPS, errori complessi). Sheet solo per permessi o per la scelta “fotocamera / galleria”.
- **Persistenza**: bozza di testo e posizione in `sessionStorage` (implementata in `components/court/submit-court-form.tsx`); la foto non è nella bozza e va rifatta dopo un reload.
- **Errori**: permesso GPS negato → “Permesso negato. Abilita la geolocalizzazione e riprova.” + campo indirizzo manuale; foto > 25MB → messaggio con la dimensione e come ridurla; nome e foto entrambi assenti → blocco con spiegazione (“Inserisci un nome o carica una foto”).
- **Uscita**: torna alla scheda del campo appena creato in stato “In revisione”, con l’esito visibile lì.

### Check-in (un passo)

- **Ingresso**: `CheckInButton` nella scheda campo.
- **Step unico**: `CheckInSheet` con nome campo, finestra del check-in e spiegazione del GPS. Nessuno stepper.
- **Azione**: “Check-in”, con loading “Verifica posizione…” e bottone disabilitato.
- **Successo**: `successPop`, “Check-in effettuato con successo!”, stato “Sei qui” con scadenza (auto-checkout a 2h).
- **Errori**: permesso negato, posizione non disponibile, timeout GPS, fuori raggio → ognuno ha il suo messaggio e “Riprova”; il fuori raggio spiega la distanza e propone “Aggiorna posizione”. Già in check-in → lo stato sostituisce la CTA, non un secondo tap.
- **Uscita**: lo stato resta nella scheda campo; il check-out è un’azione secondaria lì, non una seconda pipeline.

### Crea lobby (sheet, 1–2 passi)

- **Ingresso**: `CreateLobbyButton` (`variant="secondary"`) nella scheda campo.
- **Step**: data/ora e numero massimo di giocatori (2–30) in un solo sheet; la conferma è il bottone “Crea lobby”, non un riepilogo separato.
- **Errori**: bannato o karma insufficiente → il messaggio dice il motivo e cosa fare (“Karma troppo basso: torna sopra 50…”), non un errore generico.
- **Successo**: la lobby compare subito in “Lobby attive” con lo stato “Sei dentro”, non un toast isolato.
- **Promozione**: se in futuro la lobby avrà regole o campi aggiuntivi, l’intera pipeline passa a pagina intera, non a un secondo sheet.

### Join lobby (un passo)

- **Ingresso**: CTA nella card lobby (“Entra”), coerente con la stessa azione nella scheda campo.
- **Step unico**: conferma con orario, posti liberi e requisito karma; un solo bottone primario “Entra”.
- **Ottimistico**: la card passa a “Sei dentro” subito; se il server rifiuta (piena, scaduta, già dentro) torna indietro con il motivo e la recovery (“Posti esauriti: crea una lobby”).
- **Errori**: già dentro → stato, non errore; scaduta → la card si aggiorna e sparisce dalla lista.
- **Uscita**: “Esci” è secondaria e vive nello stato della card, non in un nuovo sheet.

## Checklist pipeline

- [ ] Ingresso, step (≤4), conferma e uscita sono dichiarati.
- [ ] Una sola CTA primaria per schermata; l’avanzamento è in fondo.
- [ ] Stepper leggibile senza colore, con `aria-current="step"`; assente se il passo è uno.
- [ ] Stato persistente con ripresa esplicita; la foto non è serializzata.
- [ ] Nessuno sheet impilato, nessun modal dentro un modal.
- [ ] Ogni errore ha causa + recovery nello stesso step.
- [ ] Empty state con CTA che avvia la pipeline.
- [ ] Coach mark solo la prima volta, uno per schermata, dismissibile.
- [ ] Back e “Indietro” tornano allo step precedente prima di uscire.
- [ ] Successo e loading hanno testo che dice cosa sta succedendo.
- [ ] `prefers-reduced-motion` verificato: nessuna informazione affidata al solo movimento.
