# Note di campo (#90)

Spec di design delle **quattro superfici** del ticket #90. La decisione di
prodotto è `docs/plans/spring.md`, voce **1b** (vincolante): nessuno stato
binario "agibile / non agibile", perché il verdetto invecchia; ogni nota ha
tipo, data e autore; il campo **non viene mai nascosto né bloccato**;
l'inserimento è riservato a chi modera, per ora. Qui non si ridiscute lo schema:
si progetta cosa vede il giocatore, cosa vede chi cura e come le note convivono
con le cose che ci sono già sulla stessa scheda.

Prototipo navigabile: `docs/design/prototypes/note-campo.html` (21 stati, 360px,
nessuna suite specifica: fa i check generici di `verify:webkit`).

## Obiettivo

Chi apre la scheda di un campo deve poter capire **in tre secondi quanto è
vecchia l'ultima informazione** sul posto, senza che quella informazione
sembri un verdetto o una recensione. Chi modera deve poter aggiungere un fatto
datato in meno di un minuto, e chi non modera non deve vedere nemmeno il
bottone.

## Vocabolario (vincolante)

Estende la tabella di [`nomi-campo.md`](nomi-campo.md): lì si separano nome e
nota, qui si separano **nota, segnalazione e recensione**, che sono tre cose
diverse che possono comparire sulla stessa schermata.

| | **Nota di campo** | **Segnalazione** | **Recensione** | **Nome** |
|---|---|---|---|---|
| Cosa dice | com'è il posto **in un giorno preciso** | "adesso c'è un problema" | com'è andata l'esperienza | come si chiama il posto |
| Chi la mette | solo chi modera (oggi, #90) | chiunque, con accesso | chi ha giocato | chiunque, passa da moderazione |
| Quanto vive | per sempre, con la data | 48 ore, poi scade da sola | per sempre | finché non cambia |
| Forma | riga neutra con data e autore | blocco `--danger` con triangolo e scadenza | stelle + testo | chip di provenienza + una riga |
| Effetto | **nessuno**: il campo resta visibile, cercabile, con check-in e lobby aperti | nessuno | media pubblica | cambia l'identità del posto |
| Parola vietata | "stato del campo", "campo rotto", "agibile" | — | — | "nome provvisorio" |

- La UI dice sempre **"Nota di campo"** o "nota", mai "stato", "verdetto",
  "allerta", "problema segnalato".
- Una nota non ha stelle, like, conferme, "utile", contatori di persone
  d'accordo: non è una recensione e non si vota.
- L'autore di una nota si mostra come ruolo — **"di chi modera"** — non come
  nickname. La nota vale per il controllo fatto, non per chi l'ha scritta; e un
  elenco pubblico di "chi ha chiuso quale campo" è un bersaglio, non
  trasparenza. `author_id` resta nel database per la responsabilità interna.

## La regola portante: un fatto con una data, mai un verdetto

1. **Niente stato, niente semaforo.** Nessun colore, nessuna icona, nessun
   badge per tipo di nota: il tipo è testo. Rosso e ambra sono già di
   segnalazioni ed errori, e un campo "rosso" sarebbe il verdetto binario che
   la voce 1b vieta.
2. **La data è parte del fatto, non metadato.** Età e data esatta stanno sulla
   stessa riga o subito sotto, sempre. Una nota senza tempo leggibile non
   esiste.
3. **Il sistema non dice mai che una nota è attuale.** Dice solo quanto è
   vecchia. Nessun badge "recente", nessun "verificato", nessun "valido fino a".
4. **Nessuna nota viene mai nascosta né cancellata dalla UI.** Le vecchie
   stanno sotto, attenuate, dietro un fold che dichiara quante sono. Non
   esiste un campo "attiva": la più nuova non sostituisce la precedente.
5. **Il campo non cambia stato.** Nessun marker diverso in mappa, nessuna riga
   di ricerca toccata, nessun blocco di check-in o lobby: la nota informa, non
   autorizza.

## Il tempo è il contenuto

### Soglia di freschezza: 30 giorni

`NOTE_FRESH_DAYS = 30`. Una nota è **fresca** se ha al massimo 30 giorni.
La soglia non si scrive in UI (nessuno deve imparare un numero): serve a
decidere peso visivo, riga di testa e riga dell'anteprima.

- **Fresca**: tipo a `--text-primary`, corpo `--text-secondary`. Compare nella
  riga dell'anteprima in mappa (superficie 3).
- **Vecchia** (oltre 30 giorni): tipo a `--text-secondary`, corpo
  `--text-muted`. Resta leggibile (AA), un gradino sotto. **Mai** nell'anteprima.
- La soglia non è un giudizio: "vecchia" non vuol dire "falsa", vuol dire
  "datata".

### Etichette di età

`noteAgeLabel(iso, now)` in `lib/court/notes.ts`, puro e testabile:

| Distanza | Etichetta |
|---|---|
| < 1 minuto | `adesso` |
| < 1 ora | `1 minuto fa` / `N minuti fa` |
| < 24 ore | `1 ora fa` / `N ore fa` |
| < 14 giorni | `1 giorno fa` / `N giorni fa` |
| < 60 giorni | `1 settimana fa` / `N settimane fa` |
| < 365 giorni | `1 mese fa` / `N mesi fa` (mai "12 mesi") |
| oltre | `1 anno fa` / `N anni fa` |

- Per la **riga di testa** (solo note vecchie) serve la stessa etichetta: la
  frase `Nessuna nota recente: l'ultima è di 4 mesi fa.` non ha casi speciali
  per "oggi", perché con una nota fresca la testa non esiste.
- La **data esatta** usa `queueDateLabel` di `lib/moderation/queue.ts`
  (`11 nov 2026`, `it-IT`, `APP_TIME_ZONE`): un formattatore solo in tutta
  l'app, niente `toLocaleDateString` sparsi.
- Le età della scheda si calcolano **sul server** e arrivano al client già
  formattate: un'etichetta relativa calcolata nel browser al primo render è un
  mismatch di idratazione garantito. Solo la nota appena aggiunta dice
  `adesso`, in locale, perché quel valore lo conosce il client.

### La riga di testa

Nella card, sotto il titolo, una riga sola. **Compare solo quando aggiunge
informazione**: se la nota più recente è vecchia, la card lo dice; se è fresca,
l'età è già sulla prima riga e la testa sarebbe una ripetizione a due dita di
distanza.

| Caso | Testo |
|---|---|
| Nessuna nota | `Nessuna nota di campo.` + `Le note raccontano com'è il posto in un giorno preciso.` |
| Più recente ≤ 30 giorni | **nessuna riga**: l'età sta sulla prima nota |
| Più recente > 30 giorni | `Nessuna nota recente: l'ultima è di 4 mesi fa.` |
| Errore di caricamento | `Non riusciamo a mostrare le note di campo.` |

L'ultima riga non è rossa: un blocco additivo che non si carica non è
un'allerta sul campo, è un pezzo di pagina che manca.

## Superficie 1 — Scheda campo

### Dove sta

In `app/(app)/courts/[id]/page.tsx`, **dopo il blocco azioni e il pulsante
Condividi, prima di `BanBannerWrapper` e di «Recensioni»**. Non tocca l'header:
nome, indirizzo, chip e cuore restano dove sono (zona identità, ticket 106).
Non tocca le CTA: check-in, crea lobby e segnala restano sopra, con la stessa
dimensione e lo stesso ordine. La lobby non si sposta: la pagina guadagna una
card, non una sezione nuova né un secondo titolo Syne.

Perché lì e non sotto il titolo: l'identità dice **chi è il posto** (e ha già
la sua riga di azione), le CTA dicono **cosa posso fare adesso**, le note dicono
**com'è il posto oggi** e vanno lette prima di decidere, cioè prima delle
recensioni e dell'elenco lobby. Sotto il titolo sarebbero un secondo blocco di
identità e litigherebbero con il chip del nome.

Solo sulle corti `approved`, come recensioni e blocco nome: una corte in
revisione non ha note pubbliche.

### Anatomia

Card (`--bg-surface`, `--border`, `rounded-card`, `p-4`), **senza accento**:

```
Note di campo                         + Aggiungi nota     ← label 11 · solo moderatori
Canestro rotto                      2 settimane fa         ← 14/600 primary · 13 muted
Il canestro di destra è senza rete.                        ← 14 secondary
4 nov 2026 · di chi modera                                 ← 12 muted
──── PRECEDENTI ────────────────────────────────────       ← 11 uppercase + filo, solo se serve
Chiuso                              4 mesi fa             ← 14/600 secondary (vecchia)
18 lug 2026 · di chi modera
                              Mostra le altre 2 note ›     ← 14/600 secondary, 44px
```

- **Titolo**: `<h2>` in `text-[var(--text-label)] font-semibold uppercase
  tracking-wider text-[var(--text-muted)]`. Non è un titolo Syne da 20px come
  "Recensioni" e "Lobby attive": è un'annotazione sul posto, non una sezione
  sociale. Stessa scelta di forma del segnaposto in `nomi-campo.html`.
- **Riga**: `flex items-baseline justify-between gap-2` per tipo ed età; corpo
  sotto, `line-height 1.45`, nessun clamp (il testo è la nota e la validazione
  lo tiene corto); meta con `<time dateTime>` e autore.
- **Separatore `Precedenti`**: appare solo quando nella parte visibile ci sono
  note fresche **e** note vecchie. Filo `--border` a destra della label: il
  confine è temporale, non categoriale.
- **Fold**: `Mostra le altre N note` (`Mostra l'altra nota` con una sola) /
  `Mostra meno`, 44px, `aria-expanded` + `aria-controls`, testo
  `14/600 --text-secondary`, chevron in `--text-muted`. **Nessun accent**:
  dentro questa card non c'è una CTA.
- **Bottone admin**: `+ Aggiungi nota`, 44px, `--text-secondary`. Il nome
  accessibile è il testo visibile: nessun `aria-label` che lo sostituisca, il
  contesto è già la scheda del campo. Per chi non è moderatore **non esiste nel
  DOM**: niente bottone disabilitato, niente lucchetto, niente "solo admin".

### Quante note si vedono

Massimo **tre righe** visibili, dalla più nuova. Le altre dietro il fold, che
dichiara il numero. Misurato a 360px: con 0 note la card è alta ~120px; con una
nota ~140px; con tre note e il fold ~400px. La pagina si allunga di una card,
non di una schermata, e la lobby resta dove è.

### Stati (copy vincolante)

| Stato | Cosa si vede | Comportamento |
|---|---|---|
| **Nessuna nota** | titolo + `Nessuna nota di campo.` + `Le note raccontano com'è il posto in un giorno preciso.` | nessuna CTA; nessun "nessun problema", che sarebbe un verdetto |
| **Nessuna nota, moderatore** | come sopra + `+ Aggiungi nota` | apre il drawer (superficie 2) |
| **Una nota fresca** | riga piena, nessuna riga di testa (l'età è sulla riga) | — |
| **Solo note vecchie** | testa `Nessuna nota recente: l'ultima è di 4 mesi fa.` + righe attenuate | nessuna riga in anteprima mappa |
| **Più di tre** | tre righe + `Mostra le altre N note` | il fold apre in pagina, non in un drawer |
| **Stesso tipo, due volte** | due righe con lo stesso tipo e due date, la nuova sopra | vedi superficie 4 |
| **Errore** | titolo + `Non riusciamo a mostrare le note di campo.` | il resto della pagina resta intatto; nessun rosso |
| **Appena aggiunta** | la nota nuova in cima con età `adesso` | stato locale al client, il DB resta la verità al reload |

## Superficie 2 — Inserimento (solo moderatori)

### Dove e come

Drawer Base UI (`components/ui/drawer.tsx`), lo stesso dei form brevi del
repo: due campi, si apre dalla card della scheda. Non è una pagina, non è una
tab di moderazione (le tre tab attuali a 360px sono già al limite, vedi
`nomi-campo.md`).

### Anatomia

```
──────── handle 44px ────────
Aggiungi una nota                       ← Syne 20
Dice com'è il campo oggi. La vedono tutti: scrivi un
fatto, non un giudizio.                 ← 13 muted

TIPO
[ Canestro rotto ]  [ Chiuso ]
[ Area privata ]    [ Illuminazione assente ]
[ Superficie rovinata ]  [ Altro ]

TESTO
[ Es. «Il canestro di destra è senza rete.» ]   ← textarea 96px, --bg-surface
                                      0/200     ← 13 tabular, a destra
Facoltativo: una riga basta. La data la mette l'app.   ← 13 muted

[ Aggiungi nota ]                       ← primary, block, disabilitata finché manca il tipo
  Annulla                               ← ghost, block
```

- **Tipo**: `<fieldset>` + `<legend>` visibile "Tipo", sei radio native
  nascoste (`sr-only`) dentro `<label>` a chip 44px, due colonne a 360px.
  Selezionata: bordo `--accent`, fondo `--accent-subtle`, testo
  `--text-primary`; non selezionata: bordo `--border-strong`, testo
  `--text-secondary`. Radio native e non `aria-pressed` come nel
  `ReportDrawer`: il gruppo è a scelta singola, le frecce devono funzionare
  senza JS, e lo screen reader deve dire "radio 1 di 6". Stessa grammatica
  visiva dei chip, semantica giusta.
- **Etichette dei tipi** (le stesse in scheda, anteprima e form). I valori DB
  sono nuovi e vivono solo in `court_notes`: non si riusa l'enum di
  `court_reports`, che ha un'altra vita e altre voci (`wet_court`, `occupied`).

  | Valore DB | Etichetta UI |
  |---|---|
  | `broken_hoop` | Canestro rotto |
  | `closed` | Chiuso |
  | `private_area` | Area privata |
  | `no_lighting` | Illuminazione assente |
  | `surface` | Superficie rovinata |
  | `other` | Altro |

- **Testo facoltativo**, obbligatorio solo per `Altro` (una nota "Altro" senza
  testo non dice niente): con `Altro` selezionato l'hint diventa `Con «Altro»
  il testo serve: altrimenti la nota non dice niente.` e il submit senza testo
  mostra `Scrivi cosa hai visto.`
- **Placeholder vivo**: cambia con il tipo scelto (`Es. «Il cancello è chiuso
  per lavori.»`, `Es. «Le luci non si accendono dalle 21.»`, …). Un esempio
  concreto è la differenza tra una nota utile e una nota inutile.
- **Tetto 200 caratteri** (`NOTE_BODY_MAX`): contatore `N/200` come nel form
  nome, `aria-describedby` → contatore + hint (+ errore), nessun `maxlength`.
- **La data non è un campo**: la mette il server, l'hint dice
  `Facoltativo: una riga basta. La data la mette l'app.` Nessuna data a mano,
  mai.
- **CTA disabilitata finché il tipo non c'è**: non è un bottone morto (è un
  form incompleto), e il repo ha già questo precedente ("Approva con questo
  nome" vuoto). Nessun errore per il tipo, che non si può sbagliare.
- Niente foto, affidabilità, "quanto è grave", "scade": fuori scope da #90.

### Stati e messaggi (vincolanti)

| Stato | Cosa cambia |
|---|---|
| Vuoto | nessun tipo, CTA disabilitata, contatore 0/200, placeholder `Aggiungi un dettaglio, se serve.` |
| Tipo scelto | chip selezionata, placeholder d'esempio del tipo, CTA attiva |
| Scritto | contatore aggiornato |
| Oltre 200 | contatore `--danger-dark`, bordo textarea `--danger`, errore `La nota può avere al massimo 200 caratteri.` (`role=alert`) |
| `Altro` vuoto | `Scrivi cosa hai visto.` (`role=alert`, focus sulla textarea) |
| Invio | campi `readOnly`, CTA disabilitata con spinner e `Aggiungo…`, `aria-busy` sul form, `Annulla` disabilitato |
| Aggiunta | blocco esito `role=status`: `Nota aggiunta.` / `{Tipo} · adesso` / `È già nella scheda del campo.` + `Chiudi` |
| Errore rete | banner `role=alert` in cima: `Non siamo riusciti ad aggiungere la nota.` / `Il testo è ancora qui.` CTA `Riprova`, valori conservati |

- Dopo l'esito, la riga nuova compare in cima alla card **senza pop e senza
  toast**: è un fatto, non un premio.
- Errori RPC: `42501` → `Non puoi aggiungere note a questo campo.`; `P0001` →
  il testo del server quando è nostro (`postgrestErrorFields`), mai Postgres
  grezzo.

## Superficie 3 — Anteprima dalla mappa

**Una riga, solo se la nota più recente è fresca**, nello stesso slot della
riga "C'è una segnalazione attiva":

```
Canestro rotto · 2 settimane fa
```

- `text-sm`, tipo `font-medium --text-primary`, età `--text-muted`, nessuna
  icona, nessun bordo, nessun colore di stato, **non è un link** (il foglio ha
  già "Apri dettaglio": un secondo percorso per la stessa cosa è spazio
  rubato).
- **Se c'è una segnalazione attiva vince la segnalazione** e la nota non si
  mostra: sono lo stesso slot, la segnalazione è più fresca per costruzione
  (48 ore) e due avvisi in un foglio da 360px sono un muro.
- **Se la nota più recente è vecchia, la riga non esiste.** In mappa si decide
  dove andare: un'informazione di quattro mesi fa, letta di sfuggita, sembra
  attuale comunque. La storia sta nella scheda.
- Una sola nota: la più recente. Nessun conteggio, nessun "e un'altra".
- Misura: la riga aggiunge ~31px al foglio (una riga più il gap), **sotto** il
  conteggio lobby e **sopra** la riga identità e i CTA, che non si muovono.

## Superficie 4 — Note vecchie e stesso tipo ri-notato

### Vecchie

Tre dispositivi, nessun verdetto:

1. **La riga di testa** compare solo con note vecchie e dice da quanto è
   l'ultima (`Nessuna nota recente: l'ultima è di 4 mesi fa.`).
2. **Il separatore `Precedenti`** mette le vecchie sotto un confine visibile
   quando convivono con una fresca.
3. **Un gradino di contrasto**: tipo `--text-secondary`, corpo `--text-muted`,
   con la data esatta sempre in chiaro. Nessuna scritta "superata", nessun
   `opacity` sul blocco (avrebbe reso il testo sotto AA).

### Stesso tipo ri-notato

- **Convivenza, mai sostituzione**: nessuna riga viene aggiornata, spostata o
  cancellata quando se ne aggiunge una dello stesso tipo. La nuova sta sopra
  (è più recente), la vecchia resta con la sua data e il suo testo. Chi legge
  vede due fatti: è esattamente quello che c'è.
- **Nessun badge "superata"**: dire che la vecchia non vale più è un verdetto
  che nessuno ha verificato. Se il canestro è stato aggiustato e poi rotto di
  nuovo, le due note dicono la verità insieme.
- **Append-only**: nella UI non c'è modifica né eliminazione. Una nota
  sbagliata si corregge con una nota nuova, datata (il testo può dirlo:
  «Correggo: era il canestro di sinistra»). Se in futuro servirà un ritiro,
  sarà un'azione di moderazione dentro `/admin`, non sulla scheda pubblica:
  resta fuori da questa consegna.

## Accessibilità

- Card: `<section aria-labelledby>`; il titolo è un `<h2>` anche se ha la
  dimensione di una label.
- Note in `<ul>/<li>`; ogni riga si legge nell'ordine: tipo, età, testo, data,
  autore. La data è `<time dateTime={iso}>`.
- Fold: `<button aria-expanded aria-controls>`, testo che cambia
  (`Mostra le altre N note` / `Mostra meno`), focus che resta sul bottone.
- Bottone admin: 44×44, testo visibile come nome accessibile, focus accent.
- Drawer: `role="dialog"`, `aria-modal`, titolo collegato, focus trap e
  ritorno al trigger (Base UI); dietro `inert`; `Escape`, backdrop e
  `Annulla` chiudono.
- Form: `fieldset`/`legend` per il tipo, radio native, `label` per la
  textarea, `aria-describedby` → contatore + hint (+ errore), `aria-invalid`,
  errore `role="alert"`, `aria-busy` in invio, esito `role="status"`.
  Sull'errore il focus va alla textarea.
- Contrasti: tipo `--text-primary` su `--bg-surface` 14,46:1; età e meta
  `--text-muted` 5,43:1; corpo `--text-secondary` 6,93:1; corpo vecchio
  `--text-muted` 5,43:1; chip selezionata `--text-primary` su
  `--accent-subtle` 11,38:1. Tutto AA a 12–14px. Nessun testo su `--accent`
  pieno tranne la CTA del form, che usa `--accent-foreground`.
- Touch: 44px su bottone admin, fold, chip; CTA 48; textarea 96 di altezza.

## Motion

- Nessuna animazione nuova. Il fold apre e chiude istantaneo (come l'editor
  inline della moderazione), il drawer usa le transizioni Base UI.
- La nota appena aggiunta **non fa pop**: comparire con enfasi la
  trasformerebbe in un premio sociale. Cambia la lista, non c'è nessuna
  animazione di conferma.
- `prefers-reduced-motion` è già coperto globalmente e qui non c'è nulla da
  spegnere: nessuna informazione è affidata al movimento.

## Token usati

`--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`,
`--accent-subtle`, `--accent-foreground`, `--border`, `--border-strong`,
`--danger`, `--danger-dark` (solo errore del form), `--overlay`,
`--focus-ring`, `--radius-control-sm|control|card|sheet|chip`, `--text-label`,
`--motion-*`. Nessun colore, raggio o misura nuova. **Niente `--warning`,
niente `--success` nella card**: una nota non è né un avviso né un successo.

## Implementazione (per la Lane D)

| File | Cosa |
|---|---|
| `supabase/migrations/0NN_court_notes.sql` | `court_notes` (`court_id` FK on delete cascade, `kind` con CHECK sui sei valori, `body` ≤ 200, `created_at`, `author_id` FK on delete set null), indice `(court_id, created_at desc)`; RLS: `select` a tutti solo su corti `approved`, `insert` solo se `profiles.is_moderator`, nessun `update`/`delete` |
| `app/(app)/courts/[id]/page.tsx` | query note in try/catch proprio (un errore non rompe la pagina), `select id,kind,body,created_at,author_id` ordinate per `created_at desc` con `limit 20`; `is_moderator` aggiunto alla select su `profiles` già presente per il banner ban, `<CourtNotes>` dopo `ShareButton` |
| `components/court/court-notes.tsx` (client) | card, testa, righe, separatore, fold, bottone admin; nota appena aggiunta in stato locale; nessun calcolo del tempo (riceve le etichette già formattate) |
| `components/court/add-note-sheet.tsx` (client) | `Drawer` + RHF/zod + `supabase.rpc("add_court_note")`, placeholder per tipo, esito ed errore da spec |
| `lib/court/notes.ts` | `NOTE_KINDS`, `noteKindLabel`, `noteAgeLabel`, `notesHeadline` (la riga di testa, solo per note vecchie), `splitNotes` (fresche/vecchie, visibili/fold); puri e testabili come `lib/moderation/queue.ts` |
| `lib/validation/schemas.ts` | `NOTE_BODY_MAX = 200`, `addNoteSchema` con `superRefine` "Altro richiede il testo" |
| `components/map/court-preview-sheet.tsx` | riga nota nello slot della segnalazione; solo fresca; la segnalazione vince; nessun link |
| `supabase/migrations/0NN_courts_in_viewport_notes.sql` + `lib/courts/search.ts` | `courts_in_viewport` restituisce `note_kind` e `note_created_at` della nota più recente (lateral join sull'indice); `Court` aggiornato. `nearby_courts` **non** cambia: le righe di ricerca non mostrano note |

- L'RPC di inserimento prende `p_court_id`, `p_kind`, `p_body`; valida
  `is_moderator` e la corte `approved` lato DB, non solo lato client.
- `author_id` si valorizza da `auth.uid()` nella RPC, mai dal client.
- Il client non calcola età né date **della scheda**: le riceve, per non avere
  un mismatch al primo render. L'anteprima in mappa è client-only e si apre
  dopo un tap: lì l'età si calcola al momento dell'apertura, che è il momento
  in cui conta. Solo la nota appena aggiunta mostra `adesso` in locale, e al
  primo reload torna la verità del server.
- `?nota=nuova` **non serve**: non c'è un deep link, il drawer è un'azione di
  moderazione, non un invito.

## Fuori perimetro (esplicito)

- **Marker in mappa, righe di ricerca, ordinamento, lista lobby, notifiche**:
  nessun cambio. Un campo con una nota recente resta visibile e cercabile
  (accettazione di #90).
- **Segnalazioni utente di agibilità** (la coda dopo la beta): #90 le lascia
  fuori; quando arriveranno riuseranno la moderazione, non questa card.
- **Modifica, eliminazione, affidabilità, foto, gravità, scadenza** di una
  nota: non esistono in questa consegna. Nessun campo "risolta".
- **Quarta tab in moderazione**: le tre attuali stanno già strette a 360px.
- **Stato "caricamento"** della card: la scheda è server-rendered, le note
  arrivano insieme al campo. Se la query fallisce, la riga neutra di errore.

## Decisioni prese al posto del ticket (la review può ribaltarle)

1. **Soglia di freschezza a 30 giorni**, non a 7 né a 90: un mese è il ciclo
   naturale di manutenzione di un campo all'aperto e produce le etichette che
   il piano già usa ("2 settimane fa").
2. **La riga di testa compare solo quando la nota più recente è vecchia**
   (`Nessuna nota recente: l'ultima è di 4 mesi fa.`); con una nota fresca non
   ripete un'età già scritta dieci pixel sopra. È il dispositivo principale
   contro "una nota di tre mesi fa sembra attuale".
3. **Le vecchie si attenuano di un gradino e vivono sotto `Precedenti`**, non
   spariscono e non si colorano.
4. **Massimo tre righe visibili + fold numerato**: la card non sposta la lobby
   più di ~400px.
5. **Nessun colore né icona per tipo, nessun accent nella card**: il tipo è
   testo, la card non compete con le CTA. Il bottone admin è neutro, non
   accent.
6. **Autore come ruolo ("di chi modera")**, non nickname: la nota vale per il
   controllo, non per la persona.
7. **Append-only nella UI**: niente modifica né eliminazione; una correzione è
   una nota nuova e datata. Il ritiro, se servirà, è un'azione di `/admin`.
8. **Niente badge "superata"** quando lo stesso tipo torna: le due note
   convivono con le loro date, nessun verdetto sul passato.
9. **Testo obbligatorio solo per "Altro"**, facoltativo per gli altri cinque:
   "Canestro rotto" è già un fatto, "Altro" senza testo è un buco.
10. **Tetto 200 caratteri** (`NOTE_BODY_MAX`): una nota è un fatto, non un
    racconto; 200 stanno in cinque righe a 360px.
11. **Chip come radio native** (non `aria-pressed` come il `ReportDrawer`):
    scelta singola, frecce e screen reader corretti senza JS. Il pattern del
    drawer segnalazioni può migrare dopo, non è lavoro di questa consegna.
12. **CTA del form disabilitata finché manca il tipo**: form incompleto, non
    utente bloccato; nessun errore per una scelta che si evita.
13. **Anteprima: solo nota fresca, una riga, e la segnalazione vince lo slot.**
    Un dato vecchio in mappa sembra attuale comunque.
14. **Errore delle note in neutro, non in rosso**: un blocco additivo mancante
    non è un allarme sul campo.
15. **Nessuna CTA per il giocatore nella card**: non c'è "segnala", non c'è
    "conferma", non c'è "utile". Le segnalazioni utente arrivano dopo la beta.

## Verify

- `npm run lint:design` verde (questa consegna non tocca `app/`, `components/`
  o `lib/`).
- `URL=http://127.0.0.1:4173/note-campo.html npm run verify:webkit` → 6/6 PASS
  (overflow, font locali, console; iPhone 13 + 360×800). Il file non ha suite
  specifica, quindi fanno fede i check generici.
- Giro dei 21 stati con uno script Playwright usa-e-getta: 0 errori console,
  0 overflow, frame 360×800 per ogni stato, chip che abilitano la CTA, fold che
  apre, esito e errore raggiungibili.
- Prova su WebKit e non solo Chromium: radio nascoste + `:checked + label`,
  `inert` dietro il foglio, `fieldset` e focus sono i punti che cambiano
  motore.

## Screenshot (360×800, `qa/screenshots/`, gitignored)

| File | Stato |
|---|---|
| `note-campo-scheda-vuota-360.png` | nessuna nota, vista pubblica (nessun bottone) |
| `note-campo-scheda-admin-360.png` | nessuna nota, moderatore |
| `note-campo-scheda-recente-360.png` | una nota fresca |
| `note-campo-scheda-vecchie-360.png` | solo note vecchie, attenuate |
| `note-campo-scheda-molte-360.png` | tre righe + fold |
| `note-campo-scheda-molte-aperte-360.png` | fold aperto |
| `note-campo-scheda-ripetuta-360.png` | stesso tipo due volte |
| `note-campo-scheda-segnalazioni-360.png` | segnalazione attiva + note |
| `note-campo-scheda-nome-360.png` | chip nome + nota vicini |
| `note-campo-scheda-errore-360.png` | errore di caricamento neutro |
| `note-campo-scheda-aggiunta-360.png` | la nota appena aggiunta, foglio chiuso |
| `note-campo-form-vuoto-360.png` | drawer vuoto, CTA disabilitata |
| `note-campo-form-tipo-360.png` | tipo scelto, CTA attiva |
| `note-campo-form-scritto-360.png` | tipo + testo |
| `note-campo-form-lungo-360.png` | oltre 200 |
| `note-campo-form-invio-360.png` | invio |
| `note-campo-form-fatta-360.png` | esito + nota in cima alla card |
| `note-campo-form-errore-360.png` | errore rete, valori conservati |
| `note-campo-anteprima-nota-360.png` | foglio mappa con una riga |
| `note-campo-anteprima-vecchia-360.png` | foglio mappa senza riga |
| `note-campo-anteprima-segnalazione-360.png` | la segnalazione vince lo slot |
