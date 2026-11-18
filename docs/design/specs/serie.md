# Serie — appuntamento ricorrente (#92)

Spec di design della Lane UI. Decisione di prodotto e schema sono del ticket
#92 (commento di @oracle): qui si progettano solo le tre superfici visibili.
Prototipo navigabile: `docs/design/prototypes/serie.html` (10 stati, 360px).

## Obiettivo

Chi organizza dichiara una volta sola il suo appuntamento (campo, giorno, ora)
e le partite arrivano da sole; chi gioca conferma la singola partita come
sempre. Dopo il primo mese l'organizzatore deve poter vedere, mettere in pausa
e cancellare le sue serie senza toccare le partite già in programma.

## Vocabolario e regole di prodotto

- **Serie**: la regola (campo, giorno, ora, sport, durata, posti). Appartiene
  a chi l'ha dichiarata.
- **Occorrenza**: una lobby vera, generata dalla serie. Si conferma come ogni
  lobby; le occorrenze nascono **con zero partecipanti**.
- **Conferma**: il join esplicito alla singola occorrenza. La serie non iscrive
  nessuno: nessuna conferma implicita, mai.
- **Generazione silenziosa**: le occorrenze compaiono senza notifiche nuove.
  Restano solo le notifiche esistenti (avviso di inizio ai riconfermati).
  Nessuna UI deve promettere o suggerire push legate alla serie.
- **Nessuno stato binario del campo**: la UI non dice mai "campo attivo /
  non attivo" come verdetto. Se il campo non genera, si dice cosa manca
  ("il campo non è attivo"), senza allarmi né colori di errore.
- Il campo lessicale è quello del `GLOSSARY.md`: serie, occorrenza, conferma.
  Mai "evento", "slot", "ricorrenza automatica".

## Superficie 1 — Opzione "Ripeti ogni settimana" nel drawer di creazione

### Dove e perché

Dentro `components/lobby/create-lobby-drawer.tsx`, **subito sotto il picker
"Orario inizio"**, prima di Sport. È l'unico punto in cui l'utente ha appena
scelto giorno e ora, quindi la regola che si ripete può essere mostrata come
conseguenza di quella scelta, senza chiedere gli stessi dati due volte.

Chi crea una partita singola vede **una riga in più, spenta**: nessun passo
obbligatorio, nessun campo nuovo, il resto del form è identico. La riga non è
un campo del form: è un interruttore con titolo e una riga di spiegazione.

### Anatomia

```
┌──────────────────────────────────────────────┐
│ Ripeti ogni settimana              [switch]  │  ← riga intera tappabile, 56px
│ Una partita sola. Accendi per un appuntamento│
│ fisso.                                       │
├──────────────────────────────────────────────┤  ← solo se acceso
│ Ogni giovedì alle 20:00, al Campo del Pineto.│  14px semibold
│ Sport, durata e posti valgono per tutte le   │  13px muted
│ partite. Le prossime due settimane si creano │
│ da sole, ognuno conferma la sua e non arriva │
│ nessuna notifica in più.                     │
└──────────────────────────────────────────────┘
```

- Contenitore: `rounded-card`, bordo `--border`, sfondo `--bg-surface`
  (come gli input del drawer, che vive su `--bg-elevated`).
- Acceso: bordo `--accent`; sfondo invariato. L'accent qui è stato di
  selezione, non CTA (stessa regola dei chip sport).
- La riga di testa è un `<button role="switch">` a tutta larghezza,
  `min-height: 56px`, `padding: 10px 14px`, testo a sinistra, track a destra.
  Il track è `--bg-base`/`--text-muted` spento, `--accent`/`--accent-foreground`
  acceso; thumb 20px, `transition-transform var(--motion-base)`.
- Testo: titolo 15px/600 `--text-primary`; hint 13px `--text-muted`.
- Il corpo espanso **non si anima**: è un form, l'animazione sposta i campi
  sotto il dito. Compare/scompare istantaneo.

### Giorno e ora: derivati, non riscritti

La regola mostrata è **quella dell'orario scelto**: `weekday` = giorno ISO
della `start_time`, `time_of_day` = ora locale della `start_time`. Nessun
secondo picker, nessuna select del giorno: due fonti di verità per lo stesso
dato sono il modo più rapido per creare una serie che non corrisponde alla
prima partita.

Conseguenze da implementare:

- Cambiare giorno o ora nel picker aggiorna la riga di riepilogo in tempo reale.
- Senza orario scelto l'interruttore resta **attivo** e il corpo dice
  "Scegli l'orario: sarà quello che si ripete." (niente controlli morti);
  il submit resta bloccato dalla validazione esistente su `startTime`.
- Il giorno della settimana si legge da `weekday` con una tabella statica
  ("lunedì"… "domenica"), non da `Intl` su una data arbitraria: il numero
  1–7 è la fonte, il testo è una costante.

### Stati

| # | Stato | Cosa vede l'utente |
|---|-------|--------------------|
| 1 | Spento (default) | Una riga: "Ripeti ogni settimana" + "Una partita sola. Accendi per un appuntamento fisso." + switch spento. Nessun altro testo. |
| 2 | Acceso | Bordo accent, hint "Appuntamento fisso: le partite si creano da sole.", corpo con riepilogo e una nota. |
| 3 | Acceso senza orario | Corpo con "Scegli l'orario: sarà quello che si ripete." e la sola nota sulla generazione. |
| 4 | Creazione in corso | CTA "Creazione…", switch `disabled` (opacità 50%, non tappabile), form `aria-busy="true"`. Il resto del form non cambia. |
| 5 | Errore della serie | Corpo sostituito da banner `--danger`: "La serie non è partita." + "Non abbiamo creato la partita. Riprova, oppure spegni «Ripeti ogni settimana» e crea solo questa." Il bottone di invio resta "Crea lobby". |
| 6 | Serie già esistente (opzionale) | Solo se la lettura `lobby_series` per campo+giorno+ora è disponibile: banner `--warning` "C'è già una serie qui il giovedì alle 20:00" + "Vedi la serie" / "Crea comunque". Se la lettura non c'è, lo stato non esiste e non si inventa. |

Nessun bottone "Riprova" separato nello stato 5: il CTA del drawer è già
l'azione da ripetere, e un secondo bottone identico a 40px di distanza è solo
un doppio invio in attesa di succedere.

**Altezza del drawer (misurata nel prototipo a 360×800).** Oggi il CTA
"Crea lobby" finisce a 772px, quindi si vede. Con l'opzione spenta il form
cresce di ~66px e il CTA esce dalla piega (807px); acceso, il drawer scorre.
È il comportamento normale di un form in sheet: **non si accorcia il form
nascondendo campi** e non si aggiunge un passo. Se la review vuole il CTA
sempre visibile, le uniche leve sono compattare il picker (#81, fuori da
#92) o spostare l'opzione in un foglio separato (scartato: un passo in più
per un'informazione che deve restare nel flusso).

### Scrittura dei dati (per @fixer, non è UI)

La lane server è già in piedi: `lib/series/client.ts` espone `createSeries`,
`updateSeries`, `setSeriesActive`, `deleteSeries`, `listMySeries`,
`listSeriesOccurrences`; gli errori passano da `lib/series/errors.ts`
(`mapSeriesError`, testi italiani già scritti).

- **Opzione accesa → si crea la Serie, non la lobby.** Il drawer chiama
  `createSeries({ courtId, weekday, timeOfDay, sport, durationMinutes,
  maxPlayers })`, dove `weekday` è il giorno ISO della data scelta e
  `timeOfDay` l'ora locale `HH:MM`. La prima occorrenza la materializza il
  server (`materialize_series`, 047, best-effort dentro `createSeries`): un
  `INSERT` diretto in `lobbies` dal client andrebbe in conflitto con
  l'unicità `(series_id, start_time)` proprio nel caso normale (data scelta =
  prossimo giorno della regola), quindi **non si fa**.
- Il picker mostra 7 giorni (`LOBBY_DAY_WINDOW`): entro quella finestra ogni
  giorno della settimana compare una volta sola, quindi la data scelta è
  sempre la prossima occorrenza di quella regola. Nessuna divergenza tra
  "quando gioco la prima" e "cosa si ripete".
- **Opzione spenta → flusso di oggi invariato** (insert in `lobbies`, avviso
  doppioni #96 compreso). Con l'opzione accesa l'avviso doppioni **non**
  scatta: una serie che si sovrappone a una lobby singola è un esito normale,
  decide il generatore (skip dello slot), non l'utente.
- Se `createSeries` fallisce: nessuna lobby, stato 5, dettaglio da
  `mapSeriesError`. `createSeries` non lancia mai: restituisce `error`.
- Successo: `createSeries` restituisce `nextOccurrence` (ISO letto dalle righe
  reali) → la copy del successo cita quella data **solo se c'è**; se è
  `null` (materializzazione fallita, copre il cron) la copy non promette una
  data.
- L'opzione accesa **non** cambia lo schema zod del form: i valori della serie
  sono quelli del form (`sport`, `durationMinutes`, `maxPlayers`).

### Copy

| Chiave | Testo |
|---|---|
| `repeatTitle` | Ripeti ogni settimana |
| `repeatHintOff` | Una partita sola. Accendi per un appuntamento fisso. |
| `repeatHintOn` | Appuntamento fisso: le partite si creano da sole. |
| `repeatSummary` | Ogni {giorno} alle {HH:MM}, al {campo}. |
| `repeatNoTime` | Scegli l'orario: sarà quello che si ripete. |
| `repeatNote` | Sport, durata e posti valgono per tutte le partite. Le prossime due settimane si creano da sole, ognuno conferma la sua e non arriva nessuna notifica in più. |
| `repeatErrorTitle` | La serie non è partita. |
| `repeatErrorBody` | Non abbiamo creato la partita. Riprova, oppure spegni «Ripeti ogni settimana» e crea solo questa. |
| `successSeriesTitle` | Serie attiva il {giorno} alle {HH:MM} |
| `successSeriesBody` | Al {campo}, a partire da {formatAppDate(nextOccurrence)}. La gestisci da «Le mie serie». |
| `successSeriesBodyNoDate` | Al {campo}. La gestisci da «Le mie serie»: le prossime partite si creano da sole. |

`successSeriesBody` usa `formatAppDate` ("giovedì 19 novembre") della
`nextOccurrence` restituita da `createSeries`; senza (`null`) si usa la
variante senza data. Il singolo successo resta identico a oggi ("Lobby
creata").

## Superficie 2 — "Le mie serie"

### Posizione

Terzo tab della pagina `/lobbies`, dopo "Le tue" e "Vicine":
`Le tue 3 · Vicine 3 · Serie 6` (i numeri sono quelli del prototipo). Stessa forma dei tab esistenti (chip
`min-h-11`, `rounded-chip`, accent sul selezionato), stesso roving tabindex e
`?tab=serie`. Il conteggio è sempre visibile, anche a zero, come gli altri.

Il tab è sempre presente: se si mostrasse solo quando c'è una serie, chi non
l'ha mai creata non scoprirebbe che esiste. La lista non ha un titolo proprio;
il tab è il titolo.

### Anatomia della riga

```
┌──────────────────────────────────────────────┐
│ Campo del Pineto                   [switch]  │  16px/600 + switch 48×44
│ Basket · 90 min                              │  13px muted (sport della serie)
│ ⤾ Ogni giovedì alle 20:00                    │  14px/600 + icona
│ Prossima: 19 novembre · 3/10 confermati      │  14px secondary
│   (piena: "24 novembre · 10/10, al completo") │  variante
│ Apri la partita ›          Cancella serie    │  44px entrambi
└──────────────────────────────────────────────┘
```

- Card: `rounded-card`, bordo `--border`, sfondo `--bg-surface`,
  padding 14/16, gap 10 (come le lobby card).
- La riga **non** è un link unico: contiene un link e un'azione distruttiva,
  quindi niente link annidati. Il nome del campo non è cliccabile; l'unico
  link è "Apri la partita", presente solo se esiste una prossima occorrenza.
- Switch: `role="switch"`, `aria-checked`, nome accessibile
  "Serie del {campo}, ogni {giorno} alle {HH:MM}"; area tappabile
  `min-width 44px`, `min-height 44px`, track 48×28. Allineato in alto a destra.
- "Cancella serie": bottone testuale `--danger` 14px/600, `min-height 44px`,
  a destra nella riga azioni. Riga azioni con `flex-wrap` per i 320px.
- Riga in pausa: badge neutro "In pausa" (`variant="default"`, non accent,
  non warning) accanto alla regola, e nota "Nessuna nuova partita finché non
  la riattivi." Le occorrenze già generate restano elencate: la pausa non
  cancella nulla.
- Campo non attivo: nota, non allarme: "Il campo non è attivo: non creiamo
  nuove partite." in `--text-secondary`, nessun colore semantico.
- "In pausa" e "campo non attivo" possono coesistere: due righe di nota.

### Cancellazione con conferma

Conferma **inline nella card**, come "Esci dalla lobby" nel dettaglio (mai un
drawer per una conferma, `patterns/sheets.md`). Il click su "Cancella serie"
sostituisce la riga azioni con:

```
┌──────────────────────────────────────────────┐
│ Cancelliamo la serie: non creeremo altre     │
│ partite. Quelle già in programma restano,    │
│ con chi si è già confermato.                 │
│ [ Sì, cancella la serie ]                    │  danger, full width
│ [ Lascia attiva ]                            │  secondary, full width
└──────────────────────────────────────────────┘
```

- Il contenitore della conferma riceve il focus (`tabindex="-1"`), come
  l'avviso doppioni del drawer: il bottone che l'ha aperta sparisce.
- "Sì, cancella" è `variant="danger"` (unico rosso pieno della schermata,
  e solo dopo un tap esplicito).
- Ottimistico: la riga sparisce, toast "Serie cancellata. Le partite in
  programma restano."; se il server rifiuta, la riga torna con errore inline
  "Non siamo riusciti a cancellare la serie. Riprova." e `role="alert"`.
- Dopo la cancellazione le occorrenze diventano lobby singole (`series_id`
  `SET NULL`): il chip ricorrenza sparisce da solo, senza codice UI.

### Stato orfana (creatore con account eliminato)

La riga orfana vive in fondo alla lista, sotto l'etichetta
"Senza organizzatore" (`text-label` maiuscolo, `--text-muted`).

```
Parco Petroselli
Basket · 90 min
⤾ Ogni mercoledì alle 19:00
Prossima: 25 novembre · 2/10 confermati
Chi ha creato la serie non ha più un account. Puoi fermarla: le partite già
in programma restano.
[ Ferma la serie ]
```

- **Niente switch**: il kill-switch dei partecipanti è irreversibile
  (`active true→false` e basta, RLS #92). Un interruttore che non si può
  riaccendere è una trappola.
- Un solo bottone testuale "Ferma la serie" (`--danger`) → stessa conferma
  inline, copy: "Fermiamo la serie: non verranno create altre partite. Quelle
  già in programma restano." + "Sì, ferma la serie" / "Lascia attiva".
- La riga compare solo se ho una conferma in una delle sue occorrenze degli
  ultimi 28 giorni (regola del ticket). Nessuna spiegazione della finestra
  in UI: è una regola tecnica, non una decisione dell'utente.

### Stati

| # | Stato | Cosa vede l'utente |
|---|-------|--------------------|
| 1 | Lista con serie | Le righe sopra, ordinate per prossima occorrenza (le serie senza occorrenze in fondo, poi le orfane). |
| 2 | In pausa | Badge "In pausa" + nota; switch spento. Le occorrenze restano. |
| 3 | Senza occorrenze | "Nessuna partita in programma." + link "Apri il campo ›". Nessun errore: è un esito del generatore, non un guasto. |
| 4 | Prossima piena | "Prossima: 19 novembre · 10/10, al completo." Link "Apri la partita" invariato. |
| 5 | Campo non attivo | Nota neutra; switch e cancellazione restano disponibili. |
| 6 | Orfana | Blocco "Senza organizzatore", niente switch, solo "Ferma la serie". |
| 7 | Conferma cancellazione | Conferma inline (sopra), focus sul contenitore. |
| 8 | Toggle in corso | Switch `disabled` + `aria-busy` sulla riga; ottimistico con rollback. |
| 9 | Vuoto | "Nessuna serie" / "Quando crei una lobby puoi renderla ripetibile: diventa il tuo appuntamento fisso al campo." + CTA "Trova un campo". |
| 10 | Errore di caricamento | Riusa lo stato errore della pagina lobby: "Non riusciamo a caricare le tue serie." + "Riprova". Mai tab vuoto silenzioso. |

### Copy

| Chiave | Testo |
|---|---|
| `tabSeries` | Serie |
| `seriesRule` | Ogni {giorno} alle {HH:MM} |
| `seriesNext` | Prossima: {giorno mese} · {n}/{max} confermati |
| `seriesNextOne` | Prossima: {giorno mese} · {n}/{max} confermato |
| `seriesNextToday` | Prossima: oggi · {n}/{max} confermati |
| `seriesNextFull` | Prossima: {giorno mese} · {n}/{max}, al completo |
| `seriesNoOccurrences` | Nessuna partita in programma. |
| `seriesOpenCourt` | Apri il campo |
| `seriesPausedBadge` | In pausa |
| `seriesPausedNote` | Nessuna nuova partita finché non la riattivi. |
| `seriesCourtInactive` | Il campo non è attivo: non creiamo nuove partite. |
| `seriesOrphanLabel` | Senza organizzatore |
| `seriesOrphanNote` | Chi ha creato la serie non ha più un account. Puoi fermarla: le partite già in programma restano. |
| `seriesStop` | Ferma la serie |
| `deleteSeries` | Cancella serie |
| `deleteSeriesConfirm` | Cancelliamo la serie: non creeremo altre partite. Quelle già in programma restano, con chi si è già confermato. |
| `deleteSeriesConfirmCta` | Sì, cancella la serie |
| `keepSeries` | Lascia attiva |
| `deleteSeriesError` | Non siamo riusciti a cancellare la serie. Riprova. |
| `deleteSeriesToast` | Serie cancellata. Le partite in programma restano. |
| `pauseToast` | Serie in pausa. Le partite già in programma restano. |
| `resumeToast` | Serie di nuovo attiva. |
| `toggleError` | Non siamo riusciti a cambiare la serie. Riprova. |
| `orphanConfirm` | Fermiamo la serie: non verranno create altre partite. Quelle già in programma restano. |
| `orphanConfirmCta` | Sì, ferma la serie |
| `emptyTitle` | Nessuna serie |
| `emptyBody` | Quando crei una lobby puoi renderla ripetibile: diventa il tuo appuntamento fisso al campo. |
| `emptyCta` | Trova un campo |
| `loadError` | Non riusciamo a caricare le tue serie. |

## Superficie 3 — Chip "Ricorrente · giovedì 20:00"

### Che cos'è

Un chip informativo (non un bottone, non un badge di stato) che dice che
l'occorrenza viene da una serie e con quale regola. Visibile su card lobby
(`lobby-card.tsx`) e dettaglio occorrenza (`lobby-detail.tsx`).

### Anatomia

```tsx
<span className="inline-flex items-center gap-1 self-start whitespace-nowrap
                 rounded-chip border border-[var(--border-strong)] px-2 py-0.5
                 text-xs font-semibold text-[var(--text-secondary)]">
  <Repeat className="h-3 w-3" aria-hidden="true" />
  Ricorrente · giovedì 20:00
</span>
```

- Testo 12px/600, **non maiuscolo**: "Ricorrente · giovedì 20:00".
- Bordo `--border-strong`, nessun riempimento: funziona sia su
  `--bg-surface` (card) sia su `--bg-base` (dettaglio) e non sparisce
  all'hover della card (che passa a `--bg-elevated`).
- Icona `Repeat` 12px, `--text-secondary`, `aria-hidden`.
- Nessun colore nuovo: `--border-strong` + `--text-secondary`
  (6,93:1 su surface, 7,75:1 su base).

### Dove

- **Card**: nel blocco testuale, su una riga propria subito sotto il nome del
  campo, sopra la riga di meta (ora, posti, distanza, sport). Non tocca né il
  nome né l'ora; la card non ricorrente resta identica, senza spazio vuoto.
- **Dettaglio**: nel blocco d'intestazione, subito sotto
  `sport · indirizzo`, sopra la card dell'ora. La card dell'ora e il badge di
  stato non si toccano.
- **Niente link** al dettaglio della serie: chi non è creatore (né
  partecipante orfano) non la vedrebbe nella lista → link morto. Il chip
  informa e basta.

### Perché non un `Badge`

`components/ui/badge.tsx` è maiuscolo, 12px, `tracking-wider`, e codifica
**stati** (Aperta, In corso, Chiusa). "Ricorrente · giovedì 20:00" non è uno
stato e in maiuscolo diventa un blocco di ~180px che compete con il badge di
stato. Il precedente è il chip "Sei dentro" in `lobby-card.tsx` (tondo,
`font-semibold`, non maiuscolo): stessa famiglia, qui 12px invece di
`text-label` per leggibilità a distanza. Deviazione registrata in `gaps.md`.

### Dati e fallback

- Card e dettaglio ricevono `series_id` + `lobby_series(weekday, time_of_day)`
  nello stesso `select` che oggi prende i campi della lobby (un join, nessuna
  query in più).
- `weekday` ISO 1–7 → `seriesWeekdayLabel()` (tabella statica già in
  `lib/series/next-occurrence.ts`); `time_of_day` → `HH:MM` con
  `formatAppTime` (mai il fuso del device).
- Serie cancellata → `series_id` NULL → il chip non c'è (corretto: non è più
  un'occorrenza). Serie in pausa → il chip resta: è provenienza, non stato.
- Se il join non restituisce la serie (riga illeggibile, vecchio dato), chip
  ridotto a "Ricorrente" senza giorno e ora: la card non si rompe.

## Casi limite (riassunto)

| Caso | Comportamento |
|---|---|
| Serie dichiarata ma zero occorrenze (campo non attivo o slot occupato) | Riga con "Nessuna partita in programma." + "Apri il campo ›". Nessun colore di errore, nessun badge. |
| Serie piena sulla prossima occorrenza | "10/10, al completo" nella riga; link alla partita invariato. La serie non riserva posti: la prossima settimana riparte da zero conferme. |
| Orfana | Sezione "Senza organizzatore", solo "Ferma la serie" con conferma; nessuno switch (irreversibile). |
| Campo non attivo | Nota neutra; la serie resta gestibile (pausa, cancella). |
| Serie cancellata | Le occorrenze diventano lobby singole; il chip sparisce; la riga esce dalla lista. |
| Serie in pausa | Le occorrenze già generate restano e si confermano normalmente. |
| Prossima occorrenza oggi | "Prossima: oggi · n/max confermati". |
| Un solo confermato | "1/10 confermato" (singolare). |
| Zero confermati | "0/10 confermati" — è il caso normale di un'occorrenza appena generata; non è un errore e non si dice "nessuno si è iscritto". |
| Utente non creatore né partecipante recente | La serie non compare in "Le mie serie"; vede solo il chip sulle occorrenze. |
| Offline alla creazione | Errore esistente del drawer, invariato: niente coda per le serie (non c'è un `enqueue` per la serie, e non si aggiunge in #92). |

## Misure e token

| Elemento | Misura | Token |
|---|---|---|
| Riga opzione (testa) | min-h 56, padding 10/14 | `--bg-surface`, `--border`, `--radius-card` |
| Riga opzione accesa | bordo 1px | `--accent` |
| Track switch | 48×28, thumb 20 | `--bg-base` / `--accent`, `--accent-foreground`, `--motion-base` |
| Area tappabile switch | ≥ 44×44 | — |
| Corpo opzione | padding 12/14, gap 8 | `--border` (separatore) |
| Riepilogo serie | 14px/600 | `--text-primary` |
| Note | 13px | `--text-muted` |
| Card serie | padding 14/16, radius 12 | `--bg-surface`, `--border`, `--radius-card` |
| Nome campo | 16px/600 | `--text-primary` |
| Regola serie | 14px/600 + icona 14 | `--text-primary`, icona `--text-secondary` |
| Meta sport/durata | 13px | `--text-muted` |
| Prossima occorrenza | 14px | `--text-secondary` |
| Link "Apri la partita" | 14px/600, min-h 44 | `--accent` |
| "Cancella serie" / "Ferma la serie" | 14px/600, min-h 44 | `--danger` |
| Chip ricorrenza | 12px/600, padding 2/8 | `--border-strong`, `--text-secondary` |
| Etichetta sezione | 11px maiuscolo | `text-label`, `--text-muted` |
| Badge "In pausa" | 12px maiuscolo | variante `default` del Badge |

Tutti i radius dalle utility tokenizzate (`rounded-control*`, `rounded-card`,
`rounded-chip`); nessun valore arbitrario. `lint:design` resta verde perché lo
scanner copre `app/`, `components/`, `lib/`.

## Accessibilità

- **Ordine di tabulazione nella riga serie**: switch → "Apri la partita" →
  "Cancella serie". La conferma inline mette il focus sul contenitore
  (`tabindex="-1"`), poi Tab porta a "Sì, cancella" e "Lascia attiva".
- **Nomi accessibili**: switch = "Serie del {campo}, ogni {giorno} alle
  {HH:MM}"; l'azione distruttiva dice cosa cancella ("Cancella la serie del
  giovedì al Campo del Pineto" nel `aria-label`, testo visibile invariato).
- **Stato non solo colore**: lo switch ha la posizione del thumb; la pausa
  aggiunge il badge testuale "In pausa" e la nota. Il chip ha l'icona e il
  testo; il bordo non è l'unico segnale.
- **Annunci**: `<p class="sr-only" role="status" aria-live="polite">` nella
  sezione, aggiornato su pausa/riattiva/cancella/esito; i toast sono
  aggiuntivi, non l'unica fonte.
- **Focus visibile** su switch, link e bottoni: anello `--focus-ring` con
  offset 2px su `--bg-base`.
- **Contrasti**: `--text-secondary` su `--bg-surface` 6,93:1;
  su `--bg-base` 7,75:1; `--text-muted` su `--bg-surface` 5,43:1;
  `--danger` su `--bg-surface` ≥ 4,5:1; badge default `--text-secondary` su
  `--bg-elevated` 5,95:1. Nessun nuovo token.
- **Touch target**: switch 48×44, link e bottoni ≥ 44px, riga opzione 56px.
- **Reduced motion**: nessuna informazione affidata al movimento; lo switch
  cambia posizione, il testo cambia. Il corpo dell'opzione non si anima.

## Motion

- Switch: `--motion-base` / `--ease-standard` sul thumb (standard del
  componente, già in uso nelle impostazioni).
- Espansione opzione, conferma inline, riga che sparisce: **nessuna
  animazione**. Sono cambi di stato dentro un form o una lista che l'utente
  sta leggendo; il movimento sposta i controlli sotto il dito.
- Toast: animazione standard di Sonner. Nessun pulse, nessun loop.
- L'unica animazione "di esito" resta `SuccessPop` dopo la creazione.

## Dati necessari (per @fixer)

La lane server c'è già; la UI non deve reimplementare query. Cosa usare e cosa
manca:

| Superficie | Fonte | Note |
|---|---|---|
| Chip su card/dettaglio | `lobbies.series_id` + join `lobby_series(weekday, time_of_day)` | Un join nello stesso `select`. `weekday` → `seriesWeekdayLabel()`; `time_of_day` → `formatAppTime`. |
| Etichetta giorno | `seriesWeekdayLabel` in `lib/series/next-occurrence.ts` | Già pronta (tabella statica 1–7). |
| Lista "Le mie serie" | `listMySeries(supabase)` in `lib/series/client.ts` | Solo `creator_id = me`, ordinate per prossima occorrenza, senza occorrenza in fondo. |
| Prossima occorrenza | `series.nextOccurrence` (ISO) | **Manca l'id**: per "n/max confermati" serve anche `nextOccurrenceId` (o il conteggio) in `SeriesWithNextOccurrence`. Senza, la riga mostra la data e non le conferme — che è metà del requisito. |
| Conferme | `lobby_participants` dell'occorrenza | Stesso conteggio delle lobby card. |
| Orfane | **Non coperte**: `listMySeries` filtra `creator_id = me` | Serve una query in più (`lobby_series` con `creator_id IS NULL` e una mia conferma in un'occorrenza con `start_time >= now − 28 giorni`) o un'estensione del client. Finché non c'è, la sezione "Senza organizzatore" non si mostra. |
| Toggle / cancella | `setSeriesActive(supabase, id, active)`, `deleteSeries(supabase, id)` | Errori già in italiano; 0 righe = RLS negata ("Solo il creatore…"). |
| Data breve "19 novembre" | `Intl` con `timeZone: APP_TIME_ZONE`, giorno+mese | Nessun helper oggi: o si aggiunge `formatAppMonthDay` a `lib/datetime.ts` (additivo, testabile) o si usa `formatAppDate` e la riga va a capo. Mai `getDate()` locale. |

File previsti (non toccati da questa lane):

- `components/lobby/create-lobby-drawer.tsx` — opzione, stati 1–5, chiamata a `createSeries`.
- `components/lobby/lobby-tabs.tsx` — terzo tab.
- `components/series/series-list.tsx`, `series-card.tsx` — lista, righe, conferme inline.
- `components/lobby/recurring-chip.tsx` — chip condiviso da card e dettaglio.
- `components/lobby/lobby-card.tsx`, `lobby-detail.tsx` — chip e `aria-label`.
- `app/(dashboard)/lobbies/page.tsx` — `listMySeries` + orfane.
- `lib/series/*` — solo le due aggiunte dichiarate sopra (`nextOccurrenceId`, orfane).

## Screenshot

360×800 in `qa/screenshots/` (cartella gitignored):
- `serie-crea-360.png`, `serie-crea-on-360.png`, `serie-crea-attesa-360.png`,
  `serie-crea-errore-360.png`, `serie-crea-fatto-360.png`
- `serie-lista-360.png`, `serie-cancella-360.png`, `serie-orfana-360.png`,
  `serie-vuota-360.png`, `serie-dettaglio-360.png`, `serie-card-360.png`
  (tab "Le tue", per il chip sulla card).
- `serie-crea-fondo-360.png`, `serie-crea-on-fondo-360.png`,
  `serie-crea-errore-fondo-360.png`: gli stessi drawer con lo scroll in fondo,
  dove sta il CTA (il form a 360×800 è più alto della piega, vedi sopra).

Verifica del prototipo: nessun overflow orizzontale, font locali caricati e
zero errori console a 360×800 e su WebKit iPhone 13
(`node scripts/verify/webkit-proto.mjs --url=…/serie.html`); le suite snap di
`verify:webkit` riguardano `nav-map-lobby.html` e non si applicano.

## Decisioni prese (la review può ribaltarle)

1. **Giorno e ora derivati dall'orario scelto**, nessun picker della regola.
   Alternativa scartata: due controlli separati (regola vs prima partita)
   che possono divergere dalla data appena scelta e far nascere una serie
   che non corrisponde a ciò che l'utente ha selezionato.
2. **Opzione subito sotto il picker**, non in fondo al form. Motivo: la
   regola è funzione dell'orario, e la riga di riepilogo deve stare accanto
   al controllo che la determina.
3. **"Le mie serie" come terzo tab**, non una sezione sotto "Le tue".
   Alternativa: un link "Le mie serie ›" sopra la lista, che non si vede se
   non si scrolla e non ha conteggio.
4. **Orfana senza switch**: solo un'azione "Ferma la serie" con conferma,
   perché la regola RLS è irreversibile.
5. **Chip non maiuscolo e non `Badge`**: la ricorrenza è un dato, non uno
   stato; il maiuscolo a 12px occupa ~180px e compete con il badge di stato.
6. **Niente link dalla card alla serie**: il chip informa, il link sarebbe
   morto per chi non gestisce la serie.
7. **Conferma di cancellazione inline**, come "Esci dalla lobby": nessun
   drawer per una conferma.
8. **Pausa e cancellazione non toccano le occorrenze**: la UI lo dice nel
   testo, non lo nasconde dietro un toast una volta sola.
9. **Nessun pallino/contatore di serie nella navigazione**: la serie non è
   una sezione di primo livello (non-obiettivi `spring.md`).
10. **Con l'opzione accesa non si crea una lobby dal client**: si crea solo
    la Serie e la prima occorrenza arriva da `materialize_series` (047). Due
    scritture client andrebbero in conflitto proprio nel caso normale (data
    scelta = prossima occorrenza), e il 23505 diventerebbe un errore da
    spiegare per un flusso che deve restare silenzioso.

## Non obiettivi

- Modifica di una serie esistente (giorno, ora, campo) da UI: il client
  `updateSeries` esiste già e il creatore ne ha diritto, ma la Lane UI di #92
  copre solo pausa e cancella. Aggiungerla è un lavoro successivo; fino ad
  allora vale "cancella e ricrea".
- Notifiche nuove, reminder, feed di serie.
- Fusione di serie doppie o deduzione della ricorrenza dallo storico
  (`Ricorrenza abituale` del glossario resta un'altra cosa).
- Stato del campo in UI: nessun verdetto binario, nessun allarme.
