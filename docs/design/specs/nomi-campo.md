# Nomi dei campi (#106)

Spec di design delle **quattro superfici visibili** del ticket #106. La
decisione di prodotto è il commento di @oracle sul ticket (vincolante): qui non
si ridiscute lo schema, il flag `is_auto_name`, le RPC o la coda di moderazione;
si progetta solo cosa vede e tocca il giocatore e chi modera.

Prototipo navigabile: `docs/design/prototypes/nomi-campo.html` (23 stati, 360px,
nessuna suite specifica: fa i check generici di `verify:webkit`).

## Obiettivo

Un campo senza nome si chiama "Spazio verde" come altri quattromila. Chi ci
gioca sa come lo chiamano davvero: deve poterlo dire in meno di un minuto, e
vedere che fine ha fatto la sua proposta. Chi modera deve poter accettare,
correggere o rifiutare un nome senza aprire un'altra schermata.

## Vocabolario (vincolante)

| Parola | Significato | Mai |
|---|---|---|
| **Nome automatico** | Nome messo dal sistema, non da una persona (`is_auto_name = true`). | "nome provvisorio", "nome generico" come etichetta visibile |
| **Nome vero** | Nome scelto da una persona e approvato. Nessuna etichetta: si vede che è vero perché il badge non c'è. | "nome ufficiale" |
| **Proposta** | Un nome proposto, in attesa. Vive in `court_name_proposals`. | "segnalazione", "suggerimento", "modifica" |
| **Nota di campo** | Problema datato sull'agibilità (1b, #90). | "stato del campo", "campo rotto" |

## La regola portante: nome ≠ nota

Il rischio dichiarato nel ticket è che le due cose si confondano. Si separano
per **zona, forma, verbo e tempo**, non con una frase che spiega la differenza.

| | Nome | Nota di campo |
|---|---|---|
| Cosa dice | l'identità del posto: come si chiama | l'agibilità di oggi: com'è adesso |
| Dove | zona identità: sotto il titolo, prima dei badge | card nella zona agibilità, dopo le azioni |
| Forma | un chip di provenienza + **una** riga di azione/stato | card con titolo, righe datate, autore |
| Chi agisce | chiunque (proposta → moderazione) | solo chi modera (per ora, #90) |
| Invecchia | no: un nome resta finché non cambia | sì: ogni nota porta la sua data |
| CTA | "Proponi il nome vero" (44px, accent) | nessuna CTA per il giocatore |

Conseguenze di implementazione:

- Il blocco nome **non è una card**, non ha bordo né sfondo: è una riga dentro il
  contenuto, con il chip che fa da ancora visiva.
- La card delle note **non usa** `--accent` né chip: titolo `Note di campo` in
  label 11px, righe 14px, data 13px muted. Nel prototipo è il blocco dello stato
  «Nome vero»: serve solo come vicino di casa, la sua forma appartiene a #90.
- Nel codice i due blocchi non condividono componenti.

## Superficie 1 — Scheda campo e anteprima dalla mappa

### Dove sta

Sulla scheda (`app/(app)/courts/[id]/page.tsx`), **dentro il blocco header,
subito dopo l'indirizzo** e prima della foto/badge: il chip spiega il nome che
l'utente ha appena letto, e due attributi (`Esterno`, `2 canestri`) non devono
sembrare la stessa cosa della provenienza del nome. Il blocco è largo quanto la
colonna, quindi va **fuori** dal `flex items-start justify-between` che tiene il
cuore.

Nel preview sheet (`components/map/court-preview-sheet.tsx`), **fuori** dalla
riga miniatura+titolo, sopra i CTA: stessa riga, stesso ordine.

### Anatomia

```
Spazio verde                              ← h1, invariato
📍 Via dell'Arte 24, Roma                 ← invariato
[ NOME AUTOMATICO ]  ✎ Proponi il nome vero ›   ← riga identità, 44px
```

- Chip: variante `default` del componente Badge (12px, uppercase,
  `tracking-wider`, `rounded-chip`, `--bg-surface` / `--text-muted`). **Non è
  cliccabile**: il badge non è un pulsante ([`components/badge.md`](../components/badge.md)).
- Riga: `display:flex; flex-wrap:wrap; column-gap:10px; row-gap:2px`; il chip
  resta a sinistra, l'azione a destra del chip quando c'è spazio, altrimenti a
  capo (a 360px con "Proposta in attesa" va a capo: è voluto).
- Azione: testo 14px/600 `--accent`, icona matita 16px, chevron 16px
  `--text-muted`, `min-height:44px`, `padding:0` (la larghezza è quella del
  testo: ~150px). Hover `--accent-hover`; focus ring `--focus-ring` con
  `outline-offset:2px`.
- Nessun bordo, nessuno sfondo, nessuna ombra: è una riga, non un riquadro.

### Stati (copy vincolante)

| Stato | Cosa si vede | Comportamento |
|---|---|---|
| **Nome vero** (`is_auto_name = false`) | **nulla**: chip, riga e spazi non esistono | zero pixel, zero query in più |
| **Invito, con accesso** | `[NOME AUTOMATICO] ✎ Proponi il nome vero ›` | apre il form (superficie 2) |
| **Invito, senza accesso** | identico | apre il login (gate d'ingresso, non a metà form), `sr-only`: "Accedi per proporre un nome". Stesso pattern di `ReportButton` |
| **Proposta propria in attesa** | `[NOME AUTOMATICO] 🕐 Proposta in attesa: «Campetto dell'Arte» ›` | è un link a «Le tue proposte» (`/submit-court#nomi`); `aria-label` "Proposta in attesa: Campetto dell'Arte. Vedi le tue proposte". Il nome della propria proposta **si vede** (RLS: il proponente vede le sue righe) |
| **Bannato / karma < 50** | `[NOME AUTOMATICO]` + "Non puoi proporre un nome adesso." (14px `--text-secondary`) + "Sei bannato fino al 24 nov 2026." (13px muted) | **nessun controllo disabilitato**: chi è bloccato legge il perché, non trova un bottone morto. Il banner ban esistente resta la fonte per il resto della pagina |

- **Mai** il nome di una proposta altrui: due chip (sport + nome) e le righe di
  ricerca non cambiano. La sola esistenza di una proposta pendente di un altro
  utente **non è pubblica** (la RLS non la espone e non c'è un conteggio): la
  pagina mostra l'invito, e il vincolo "una aperta per campo per utente" è
  l'indice unico parziale lato DB. Conseguenza accettata: due persone possono
  proporre lo stesso nome; la seconda riceve un rifiuto con motivo.
- **Nessun badge nelle righe di ricerca** (deciso): la riga ha già distanza,
  sport e tipo di luogo; 9.572 chip sarebbero rumore. Due "Spazio verde" a 300 m
  restano distinguibili solo dalla distanza: è accettato, la cura la fa il nome
  approvato, non il badge.
- **Nessun badge** in mappa, lista lobby, notifiche.

## Superficie 2 — Form proposta (bottom sheet)

### Dove e come si apre

- Dalla riga identità della scheda: `Drawer` (Base UI) come il drawer lobby, titolo
  `Proponi il nome`.
- Dal preview sheet: **non** un drawer dentro un drawer. La riga del foglio è un
  link a `/courts/<id>?proponi=nome`; la scheda legge `searchParams` e passa
  `initialOpen` al client (nessuna `useSearchParams` + Suspense). Dopo
  l'apertura, `history.replaceState` toglie il parametro: un reload non riapre.
- Da `?proponi=nome` senza accesso: login con `redirectTo` sullo stesso URL;
  bloccato o già in attesa: la scheda mostra il suo stato, il form non si apre.

### Anatomia

```
──────── handle 44px ────────
Proponi il nome                    ← titolo Syne 20
Questo nome l'ha messo il sistema. Se sai come lo
chiamano lì, scrivilo: lo rivede chi modera.    ← lead 13 muted

┌ ADESSO     Spazio verde ┐        ← riquadro `--bg-surface`, radius control,
│ PROPOSTO   Campetto …   │          bordo `--border`, padding 12
└─────────────────────────┘
Nome del campo                     ← label 14/600
[ Es. Campetto dell'Arte        ]  ← Input 48px, `--bg-surface`
                                  18/120
Un nome di luogo, non una descrizione: «Campetto dell'Arte»,
non «campo di basket».             ← hint 13 muted
[ Invia proposta ]                 ← primary, block
  Annulla                          ← quiet
```

- Riepilogo: `dl` a due colonne (72px la label), label 11px uppercase muted,
  "Adesso" 14px `--text-secondary`, "Proposto" 14px/600 `--text-primary`.
  **Aggiornato mentre si scrive**; vuoto → `—` muted.
  Massimo **due righe** con ellissi: il testo intero è nell'input, il riepilogo
  non deve allungare il foglio.
- Contatore: `N/120`, cifre tabulari, 13px; sopra i 120 diventa `--danger-dark`
  e il bordo dell'input `--danger`. `aria-describedby` punta a contatore + hint
  (+ errore quando c'è).
- 120 = `COURT_NAME_MAX` (`lib/validation/schemas.ts`): nessun numero nuovo.
  L'input **non** ha `maxlength` (stessa scelta di `submit_court`: il tetto è
  validato, non troncato a metà digitazione).
- CTA sempre attiva (scelta d15): la validazione avviene al submit, non
  disabilitando il bottone.
- Il form **non** chiede sport, superficie, posizione o foto: si tocca solo il
  nome della corte che esiste già.

### Stati e messaggi (vincolanti)

| Stato | Cosa cambia |
|---|---|
| Vuoto | contatore 0/120, riepilogo "Proposto —" |
| Compilato | riepilogo vivo, contatore aggiornato |
| **Nome uguale all'attuale** | errore inline: "È già il nome di questo campo." Confronto su trim + spazi collassati + case-insensitive |
| **Oltre 120** | "Il nome può avere al massimo 120 caratteri." (stesso testo del resto dell'app) |
| **Proposta propria già aperta** | "Hai già una proposta in attesa su questo campo: la trovi in «Le tue proposte»." Fallback per pagina stantia: nel flusso normale l'invito è già sostituito dallo stato "in attesa" |
| Vuoto al submit | "Scrivi il nome del campo." |
| Invio | input `readonly`, CTA disabilitata con spinner + "Invio…", `aria-busy` sul pannello, "Annulla" disabilitato |
| Inviata | il form lascia il posto a un blocco esito (`role=status`): "Proposta inviata." / "«Campetto dell'Arte» è in revisione." / "Lo rivede chi modera. La trovi in «Le tue proposte»: da lì puoi ritirarla." CTA `Le tue proposte` + `Chiudi`. Nessun timer di chiusura |
| Errore rete | banner `role=alert`: "Non siamo riusciti a inviare la proposta." / "Il nome è ancora qui." CTA `Riprova`, valori conservati |

- I due controlli anti-duplicato (nome uguale, proposta già aperta) sono **client**,
  prima della RPC; l'indice unico parziale e il rate limit restano la difesa
  server. Errori RPC: `42501` autorizzazione, `P0001` validazione (convenzione
  026/030), mostrati nell'errore inline con il testo del server quando è nostro.

## Superficie 3 — «Nomi che hai proposto»

### Dove

Nella pagina `/submit-court`, **sotto** la sezione esistente «Le tue proposte»
(campi inviati). Il titolo della nuova sezione è **«Nomi che hai proposto»**:
non si duplica «Le tue proposte» nello stesso schermo, e la parola "nome" dice
subito di cosa si tratta. La sezione compare **solo se c'è almeno una riga**
(stessa regola di `MySubmissions`: niente blocco vuoto).

Ancora: `/submit-court#nomi` (bersaglio del link "Proposta in attesa" nella
scheda). La sezione ha `id="nomi"`.

### Riga e stati

```
┌───────────────────────────────────────────┐
│ Campetto dell'Arte        [IN REVISIONE]  │  16/600 + badge
│ per «Spazio verde» · 16 nov 2026          │  13 muted
│ [ Ritira ]                                │  solo pending
└───────────────────────────────────────────┘
```

| Stato DB | Badge | Riga | Azione |
|---|---|---|---|
| `pending` | `accent` "In revisione" | `per «{nome attuale}» · {data}` | `Ritira` (secondary sm) |
| `approved` | `success` "Accettata" | `Ora è il nome del campo · {data}` | nessuna |
| `rejected` | `danger` "Rifiutata" | `Motivo: {moderator_note}` (14px, con "Motivo:" in `--text-primary`) + `per «{nome}» · {data}` | nessuna |
| `withdrawn` | `default` "Ritirata" | `Ritirata da te · {data}` | nessuna |

- **Niente "Riprova"** sulle rifiutate: a differenza di una proposta di campo,
  qui il campo esiste già e il nome attuale può essere cambiato nel frattempo.
  Si ripropone dalla scheda, dove il nome vero è davanti agli occhi.
- **Ritiro in due passi dentro la riga** (non un drawer): `Ritira` → pannello
  "Ritirare la proposta?" / "Il nome del campo resta quello di adesso. Puoi
  proporne un altro quando vuoi." + `Indietro` / `Conferma ritiro`. Il trigger
  sparisce mentre la conferma è aperta (pattern di `MySubmissions`), il focus va
  al pannello e torna al trigger su "Indietro".
- Ritiro **non distruttivo**: il pannello usa `--border-strong`, non `--danger`;
  nessun rosso, nessuna icona cestino. La differenza con il ritiro di un campo
  (che cancella foto e proposta) deve leggersi anche dal colore.
- Dopo il ritiro la riga **resta** con badge "Ritirata" e "Ritirata da te ·
  adesso" (il DB conserva la riga: `withdrawn`, non delete). Toast "Proposta
  ritirata." come nel resto dell'app.
- A 360px nome e badge stanno su due righe quando il nome è lungo (`line-clamp`
  a 2, badge `shrink-0`): stessa scelta di `MySubmissions`.

## Superficie 4 — Terza tab «Nomi» in moderazione

### Tab

Ordine: **Proposte · Segnalazioni · Nomi** (il ticket: "terza tab Nomi dopo
Proposte/Segnalazioni"). Conteggio accanto alla label (`tabular-nums`), nascosto
solo sulla tab in errore (come oggi per le altre due).

**Le icone escono dalle tre tab.** Con tre tab e i conteggi, a 360px le tre
pillole occupano **esattamente i 318px disponibili** (105 + 121 + 76 + 16 di
gap): le icone (22px ciascuna) le mandavano a capo su due righe. Con le tre
cifre (il tetto della coda è 200) la terza va a capo: `flex-wrap` sul tablist,
nessuno scroll orizzontale, nessuna tab nascosta. Alternativa scartata:
`overflow-x:auto`, che nasconde una tab in un strumento di lavoro.

### Riga

```
┌────────────────────────────────────────────────┐
│ ADESSO    Spazio verde                         │  11px label / 14px secondary
│ PROPOSTO  Campetto dell'Arte                   │  11px label / 16px 600 primary
│ Via dell'Arte 24 · di marco_rm · 2 ore fa      │  13px muted
│ [ Approva ] [ Modifica ] [ Rifiuta ]           │  44px, flex 1, min 84
└────────────────────────────────────────────────┘
```

- Coppia `adesso/proposto` in `dl` a 64px: **la stessa forma del riepilogo del
  form**, così il moderatore riconosce subito le due colonne.
- Quando `is_auto_name` è vero la label dice **`Adesso · automatico`** (testo,
  non un chip: in una lista di cento righe i chip sono rumore).
- Autore: nickname da `profiles` (`resolveNickname`), fallback "un giocatore".
  Età: `submittedAgoLabel` di `lib/moderation/queue.ts` ("2 ore fa", poi data).
- Ordine FIFO (dal più vecchio), `LIMIT` come le proposte campo (200).

### Le tre azioni

| Azione | Flusso |
|---|---|
| **Approva** | `approve_name_proposal(p_id)` diretto. Nessuna conferma: è il caso normale |
| **Modifica** | apre l'editor inline: label "Nome che approvi", input precompilato con il nome proposto (tetto 120), hint "Puoi correggerlo prima di approvare.", `Annulla` / `Approva con questo nome`. Una sola chiamata: `approve_name_proposal(p_id, p_edited_name)` |
| **Rifiuta** | apre l'editor inline: label "Motivo del rifiuto", textarea **obbligatoria**, hint "Lo vedrà chi ha proposto: senza motivo non si rifiuta.", errore "Scrivi il motivo del rifiuto." (`role=alert`, focus sulla textarea), `Annulla` / `Conferma rifiuto` |

- Un solo editor aperto per riga: aprire "Rifiuta" chiude "Modifica" (e
  viceversa). Il trigger ha `aria-expanded`; il focus va al primo campo; il
  ritorno va al trigger su "Annulla".
- "Approva con questo nome" è **disabilitato** con input vuoto (niente bottone
  morto, niente errore per un caso che si evita).
- Dopo un'azione: **nessun optimistic update**. Rifetch della coda, riga che
  sparisce, live region `role=status` in cima: "Nome approvato: «…»." /
  "Nome rifiutato. Motivo: …" — stesso `run()` del pannello. Errore di riga in
  loco con `role=alert`, coda invariata.
- Approvare un nome chiude d'ufficio le altre pendenti sulla stessa corte
  (decisione DB): la riga sparisce anche per loro, nessuna UI in più.

### Stati

| Stato | Cosa si vede |
|---|---|
| Coda | righe come sopra, lead "Dal più vecchio. Approvare un nome lo rende pubblico subito." |
| Correggi | editor aperto, valore modificato |
| Rifiuta | textarea vuota + errore obbligatorio |
| Vuota | card centrata: check, "Nessun nome in attesa.", "Le proposte dei giocatori arrivano qui." (stesso pattern delle proposte campo) |
| Errore | banner `role=alert`: "Non riusciamo a caricare i nomi." / "Controlla la connessione e riprova." + `Riprova`; conteggio nascosto |
| Molte righe | il tabpanel scorre dentro la pagina (nessun sotto-scroll): a 360×800 si vedono 3 righe e mezza, la quarta è tagliata dal bordo |

## Accessibilità

- Chip: testo, non controllo. La riga identità ha **un solo** focus stop.
- `Proponi il nome vero` è un `<button>` (apre il drawer) o `<a>` (deep link dal
  foglio): sempre ≥44px, focus visibile, nome accessibile che include il campo
  quando serve ("Proponi il nome vero per Spazio verde").
- Form: `label` esplicita, `aria-describedby` → contatore + hint (+ errore),
  `aria-invalid` sull'input, errore `role="alert"`, `aria-busy` sul pannello in
  invio, contatore con `aria-hidden` + testo `sr-only` "N caratteri su 120".
- Esito in sheet `role="status" aria-live="polite"`; errori di rete `role="alert"`.
- Tablist: `role=tablist` + `role=tab` + `role=tabpanel`, frecce ←/→, `tabindex`
  mobile, pannello `hidden` non selezionato.
- Editor di moderazione: `aria-expanded` + `aria-controls`, label associata,
  errore `role="alert"`, focus gestito su apertura/chiusura.
- Bottoni in riga: 44px, testo 14px/600; a 360 stanno in fila (84px minimo
  ciascuno). Se il testo cresce (ingrandimento caratteri) vanno a capo, mai
  troncati.
- Colori: chip `--text-muted` su `--bg-surface` 5,43:1; azione accent su base
  6,37:1; badge success/danger/`--*-dark` come da `tokens.md`; nessun bianco su
  accent.
- Contrasto del "Proposta in attesa": `--text-primary` su `--bg-base` (16:1) con
  icona `--text-muted`.

## Motion

- Nessuna animazione nuova. La riga identità non si anima; l'editor inline
  compare/scompare istantaneo (sposta i campi sotto il dito, come il corpo
  espanso del drawer lobby); il drawer e il toast usano quello che c'è.
- `prefers-reduced-motion`: già coperto globalmente; nessuna informazione è
  affidata al movimento.

## Token usati

`--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`,
`--accent-subtle`, `--accent-foreground`, `--success`, `--success-dark`,
`--danger`, `--danger-dark`, `--warning`, `--warning-dark`, `--border`,
`--border-strong`, `--cool-muted`, `--overlay`, `--focus-ring`,
`--radius-control-sm|control|card|sheet|chip`, `--text-label`, `--motion-*`.
Nessun colore, raggio o misura nuova. `lint:design` non ha eccezioni da
aggiungere: le quattro superfici non usano valori arbitrari.

## Implementazione (per la Lane D)

| File | Cosa |
|---|---|
| `app/(app)/courts/[id]/page.tsx` | legge `searchParams.proponi`, `is_auto_name` (già in `select("*")`), una query additiva per la propria pending (try/catch come check-in/preferiti) e monta il blocco |
| `components/court/name-provenance.tsx` (client) | chip + riga nei suoi stati + drawer + login gate; riceve `courtId`, `courtName`, `isAutoName`, `signedIn`, `blockedReason`, `ownPendingName`, `initialOpen` |
| `components/court/propose-name-sheet.tsx` (client) | `Drawer` + RHF + zod (nuovo `proposeNameSchema` in `lib/validation/schemas.ts`, 1–120) + `supabase.rpc("propose_court_name")` |
| `components/court/my-name-proposals.tsx` (client) | sezione di superficie 3, `id="nomi"` |
| `lib/court/name-proposals.ts` | mapper puri: riga → `{ name, statusLabel, badgeVariant, currentName, dateLabel, moderationNote }`, testabile |
| `components/map/court-preview-sheet.tsx` | riga identità sopra i CTA; la riga è un **link** a `/courts/<id>?proponi=nome` |
| `components/moderation/moderation-panel.tsx` | terza tab, `TAB_IDS = ["courts","reports","names"]`, `flex-wrap` sul tablist, icone rimosse |
| `components/moderation/name-proposal-card.tsx` | riga + due editor inline, stesso `busy`/`disabled`/`errorText` di `PendingCourtCard` |
| `lib/moderation/queries.ts` + `queue.ts` | `fetchPendingNameProposals` (LIMIT 200, FIFO) e `mapNameProposal` |
| `lib/courts/search.ts` | `is_auto_name` nel tipo `Court` (colonne RPC di 050) |

- **Il preview sheet non ha il dato "propria pending"**: `courts_in_viewport` non
  lo espone e non si tocca. Prima versione: il foglio mostra chip + invito; chi
  ha già una proposta lo scopre nella scheda un tap dopo. Lo stato "in attesa"
  del prototipo è il target quando il dato arriverà (lettura lazy all'apertura,
  se il costo è accettabile).
- `?proponi=nome` apre il drawer solo con accesso, non bloccato, senza pending;
  poi ripulisce l'URL.
- Errori: `postgrestErrorFields` + un mapper per `propose_court_name`; mai
  messaggi Postgres grezzi in UI.
- La tab "Nomi" non mostra nulla di una corte non `approved`: la RPC di
  moderazione leggerà solo proposte vive.

## Fuori perimetro (esplicito)

- Righe di ricerca, mappa, lista lobby, notifiche: **nessun cambio visivo**.
- Correggere il nome di un campo che **ha già** un nome vero: oggi non c'è una
  CTA. Il badge compare solo su `is_auto_name`, quindi la correzione di un nome
  vero esiste solo lato moderazione. Se serve, è una decisione a sé (una voce in
  scheda "Segnala un nome sbagliato" cambierebbe il tono e la coda).
- Notifiche sull'esito della proposta: non progettate qui. Il copy non promette
  push: dice "La trovi in «Le tue proposte»".
- Forma e copy delle Note di campo (#90): il blocco nel prototipo è un
  segnaposto di ingombro.

## Decisioni prese al posto del ticket (la review può ribaltarle)

1. **Prefisso "Proponi il nome vero"** con matita + chevron, come link accent
   senza bordo, invece di un bottone pieno: il ticket chiede "discreto".
2. **Un chip solo**: `Nome automatico` resta anche quando c'è una propria
   proposta in attesa (la pendenza è un processo, non una proprietà del nome).
   La seconda informazione sta nella riga di stato, non in un secondo chip.
3. **`Proposta in attesa` mostra il nome della propria proposta**; quella altrui
   non esiste per il pubblico (nessun conteggio, nessun "una proposta in
   attesa"). Rischio: due proposte identiche, la seconda rifiutata.
4. **Bloccato = nessun controllo**, non un bottone disabilitato: si legge il
   perché. Duplica la data del banner ban (accettato).
5. **Il preview sheet non apre il form** ma ci porta: `?proponi=nome`. Un drawer
   dentro un drawer è peggio di un tap in più, e nella scheda si vede indirizzo
   e nome intero mentre si scrive.
6. **Riepilogo "adesso → proposto" clippato a 2 righe**: il testo intero resta
   nell'input. Nome oltre le 2 righe = nome raro.
7. **Nessun `maxlength`** sul campo nome (120 validato); `maxlength` resta
   nell'editor di moderazione, dove il campo è precompilato e chi scrive è un
   moderatore.
8. **"Nomi che hai proposto"** invece di un secondo "Le tue proposte", e niente
   "Riprova" sulle rifiutate (si ripropone dalla scheda).
9. **Ritiro in due passi dentro la riga**, in colore neutro (non distruttivo).
10. **Tab: icone rimosse** per far stare le tre pillole su una riga a 360px;
    `flex-wrap` per le tre cifre. Ordine Proposte → Segnalazioni → Nomi.
11. **`Rifiuta` obbligatorio, `Approva con modifica` in un solo passo** (firma
    con override della RPC), con bottone disabilitato a campo vuoto.
12. **Nessun badge nelle righe di ricerca** (dal ticket) e **nessun conteggio
    pubblico** delle proposte.

## Verify

- `npm run lint:design` verde (nessun file in `app/`, `components/`, `lib/`
  toccato da questa consegna: la spec non introduce valori arbitrari).
- `URL=http://127.0.0.1:4173/nomi-campo.html npm run verify:webkit` → 6/6 PASS
  (overflow, font locali, console, iPhone 13 + 360×800; il file non ha suite
  specifica, quindi fanno fede i check generici).
- Controllo dei 23 stati e delle interazioni (apertura/chiusura foglio, invio
  valido/non valido, tab con frecce, editor, ritiro, rifiuto senza nota) fatto
  con uno script Playwright usa-e-getta: 0 errori console, 0 overflow, frame
  360×800 per ogni stato.
- Prova su WebKit, non solo Chromium: `inert`, focus trap, `hidden` e i wrapper
  dei tab sono i punti che cambiano motore.

## Screenshot (360×800, `qa/screenshots/`, gitignored)

| File | Stato |
|---|---|
| `nomi-campo-scheda-ospite-360.png` | invito senza accesso |
| `nomi-campo-scheda-invito-360.png` | invito con accesso |
| `nomi-campo-scheda-attesa-360.png` | proposta propria in attesa |
| `nomi-campo-scheda-blocco-360.png` | bannato |
| `nomi-campo-scheda-nomevero-note-360.png` | nome vero + Note di campo |
| `nomi-campo-anteprima-360.png` | preview sheet con chip e invito |
| `nomi-campo-anteprima-attesa-360.png` | preview sheet con proposta in attesa |
| `nomi-campo-form-vuoto-360.png` | form vuoto |
| `nomi-campo-form-scritto-360.png` | form compilato |
| `nomi-campo-form-uguale-360.png` | errore: nome uguale |
| `nomi-campo-form-lungo-360.png` | errore: oltre 120 |
| `nomi-campo-form-attesa-360.png` | errore: proposta già aperta |
| `nomi-campo-form-invio-360.png` | invio |
| `nomi-campo-form-inviata-360.png` | inviata |
| `nomi-campo-form-rete-360.png` | errore di rete |
| `nomi-campo-proposte-360.png` | quattro esiti |
| `nomi-campo-proposte-ritiro-360.png` | conferma di ritiro |
| `nomi-campo-mod-coda-360.png` | coda Nomi |
| `nomi-campo-mod-correggi-360.png` | approva con modifica |
| `nomi-campo-mod-rifiuta-360.png` | rifiuto con nota obbligatoria |
| `nomi-campo-mod-vuota-360.png` | vuota |
| `nomi-campo-mod-errore-360.png` | errore |
| `nomi-campo-mod-scroll-360.png` | molte righe |
