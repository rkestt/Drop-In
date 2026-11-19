# Home — ricerca per nome

Dove vive la ricerca quando la home è mappa full-bleed + foglio "Partite vicine".
**Lane 1 di #89**, 19 nov 2026 — proposta da approvare prima dell'implementazione
(Lane B). Prototipo: `docs/design/prototypes/nav-map-lobby.html` (stati «Ricerca» nella
toolbar). Il foglio, gli snap e le card restano quelli approvati il 17 nov: qui si
aggiunge solo la ricerca.

## Obiettivo

Trovare **un campo che conosci per nome** mentre la mappa è già lì: si scrive, si vede
dove sono i campi che corrispondono, si tocca quello giusto. La ricerca è un **ingresso
della mappa**, non un contenuto del foglio.

Chi apre l'app in strada, con una mano, spesso cerca un campo specifico: la ricerca deve
costare **un tocco** (il campo), non un gesto per aprire il foglio e nemmeno un tap su
un'icona per scoprire dove si cerca. Per questo sta sempre nello stesso posto, sopra la
mappa, e non si sposta mai — né quando il foglio sale, né quando arrivano i risultati,
né quando esce la tastiera.

## Decisioni

### 1. Dove sta la barra: seconda riga del chrome sopra la mappa, sempre visibile

```
┌───────────────────────────────────┐
│ [Tutti gli sport ▾]        [ 🔔 ] │  44px   (riga esistente)
│ [ 🔍 Cerca un campo per nome…  ×] │  48px   (nuova)
└───────────────────────────────────┘
  mappa
┌───────────────────────────────────┐
│  handle · titolo · striscia       │  foglio
└───────────────────────────────────┘
│  Mappa                    Profilo │  nav 56px
```

- Stesso blocco del selettore sport e del campanello: 12px dai bordi, `bg-elevated`,
  bordo `--border-strong`, ombra, raggio `--radius-control`. Non è un controllo dentro
  una pagina: è chrome sopra la mappa, e si legge come gli altri due.
- **Conseguenza da mettere in conto**: il foglio pieno si ferma **sotto** il chrome
  invece di coprirlo — `piena = contenitore − nav − 112 − 8`. Il chrome non viene mai
  coperto, quindi la barra non si sposta quando il foglio cambia altezza. **Costo
  dichiarato: 120px alla piena** (112 di chrome + 8 di stacco): su 360×720 il foglio passa
  da 664 a **544px**. In cambio il chrome continua a fare il suo lavoro anche a foglio
  pieno (lo sport si cambia lì, e il filtro si applica alla lista).

Perché non le alternative:

- **Dentro il foglio (solo a piena)**: cercare costerebbe due gesti (alzare il foglio,
  poi toccare il campo) e a striscia la ricerca sarebbe invisibile. In più il campo
  dentro il foglio cresce la striscia di ~56px (144 → ~200) e con la tastiera aperta il
  campo finirebbe a metà schermo, con i risultati sotto la tastiera.
- **Nascosta dietro un'icona**: un tap in più proprio sull'azione più diretta, e la riga
  dei filtri cambierebbe forma quando la ricerca si apre (il selettore sport sparirebbe).
- **Terza altezza del foglio per la ricerca**: due snap sono approvati; un terzo stato
  accoppiato alla ricerca moltiplica i casi da verificare senza dare niente in più.

**Sulla reach con una mano**: il punto alto dello schermo è la zona meno comoda per il
pollice, ma il tocco che apre la ricerca costa lo stesso in tutte e tre le opzioni — il
campo o l'icona stanno lì. La differenza sono i **tocchi** (1 contro 2) e la scoperta
(il campo si vede, l'icona si indovina). Poi si scrive sulla tastiera in basso e i
risultati stanno sotto il pollice: la reach non peggiora rispetto alle alternative che
tengono la ricerca in alto.

### 2. Cosa succede quando scrivi: un solo elenco alla volta

- **Il foglio va a piena da solo** appena il campo prende il focus (la tastiera sale e il
  foglio sale con lei): la ricerca ha una sola altezza e non esistono stati
  «ricerca × striscia». Con query vuota il foglio resta sulle partite; è la query a
  decidere il contenuto.
- Con una query attiva il foglio mostra **solo i campi trovati**. La striscia, l'elenco
  delle partite, il piede («5 partite entro 5 km») e la CTA «Dichiara una serata»
  spariscono: **mai due elenchi insieme**, che è il difetto della home di oggi (i
  risultati si impilavano sopra le lobby, senza dire se avevano filtrato).
- La testa cambia nome e dice cosa stai guardando: **«Partite vicine» → «Campi trovati»**,
  con il chip del conteggio e `entro 25 km` come riga di contesto.
- **Il chip sport resta**: è lo stesso filtro, visibile e utilizzabile anche a foglio
  pieno. Cambiare sport con una query attiva **rilancia la ricerca** con il nuovo filtro
  (comportamento già in `page.tsx`, `p_sport` sulla RPC). Nessun chip sport duplicato nel
  foglio.
- **I pin seguono la query** (i marker sono i risultati, come oggi: una sola verità per
  mappa e lista). A foglio pieno sono coperti: la ricerca per nome è una lista, non
  un'esplorazione della mappa. Nessun volo della mappa, nessuna compensazione di camera —
  costo accettato dal piano di #89.
- Il tocco su un risultato resta un **link a `/courts/<id>`**: è il comportamento di
  oggi e non va reindirizzato in silenzio verso lobby o anteprima.

### 3. Cosa succede quando chiudi la ricerca

Si torna alle partite **esattamente come prima**, senza salti:

- **snap di prima**: `snapBefore` è lo snap che il foglio aveva quando il campo ha preso
  il focus (striscia o piena). Chiudere riporta lì.
- **stessa lista, stesso punto di scroll** (`scrollTop` salvato all'ingresso e ripristinato
  all'uscita): la lista delle partite è la stessa istanza, non un remount.
- **nessuna fetch**: la query vuota rimette i marker del browse (`courts` già in pagina) e
  le lobby sono già in memoria; la camera non si muove.
- **tastiera chiusa** e **focus sull'handle** (non sul `body`): l'handle è il controllo
  del nuovo stato e la prossima Tab entra nella lista.
- Una transizione di 250ms accompagna il ritorno (stessa curva del foglio); con
  `prefers-reduced-motion` è 0,01ms e l'informazione resta.

Chiusure esplicite: **× nel campo**, **Esc**, **trascinare il foglio verso il basso dalla
cima dei risultati** (il gesto che chiude il foglio, in ricerca lo chiude) e la CTA
**«Cancella la ricerca»** nello stato vuoto. Svuotare il campo col backspace **non**
riporta allo snap di prima: mentre la tastiera è aperta il foglio resta a piena con le
partite (altrimenti la lista finirebbe sotto la tastiera); è il blur a riportarlo giù.

### 4. Cosa succede al foglio mentre la tastiera è aperta (iOS)

- Il foglio si appoggia **sul bordo della tastiera**, non sulla nav (che è sotto la
  tastiera): `bottom = innerHeight − visualViewport.height − visualViewport.offsetTop`
  quando è > 0, altrimenti `nav` (che contiene già `env(safe-area-inset-bottom)`).
- Altezza ricalcolata a ogni `visualViewport.resize` (e `scroll`, per l'`offsetTop` che
  cambia quando Safari pan-na): niente `dvh` quotato al mount, niente `scrollIntoView`.
- In ricerca la riga di contesto (`entro 25 km`) **sparisce** con la tastiera: è la prima
  cosa sacrificabile, il conteggio resta nel chip.
- **Nessuna CTA nel foglio durante la ricerca**: le righe sono link, l'unico bottone è
  nella testa del campo (×) e nello stato vuoto. Niente finisce sotto il dito, e la nav
  dietro la tastiera non serve.
- Spazio reale: a 390×664 con la tastiera (300px simulati) il foglio è **244px** con
  ~2 righe visibili; senza tastiera 488px con ~4,5 righe. Su schermi più alti sale da
  solo. La lista scorre, il chrome non si muove — è il compromesso dichiarato.
- L'handle è **nascosto** in ricerca (si chiude in 200ms): il foglio ha una sola altezza
  e un grip che non trascina sarebbe una bugia. Il gesto verso il basso continua a
  funzionare sulla lista.

### 5. Stati vuoti riconciliati (oggi ce ne sono due quasi uguali)

Tre vuoti diversi, un solo modo di raccontarli (icona `--text-muted` 32, titolo Syne 20,
corpo 15 `--text-secondary`, una sola azione):

| Vuoto | Quando | Dove | Titolo | Corpo | Azione |
|---|---|---|---|---|---|
| **Nessuna partita (striscia)** | 0 lobby entro 15 km | striscia del foglio | `Nessuna partita, per ora` (stringa approvata, invariata) | — | **`Dichiara la serata`** (primary) |
| **Nessuna partita (piena)** | idem, foglio pieno | corpo del foglio | `Apri tu la serata`; kicker `Nessuna partita, per ora` (con sport: `Nessuna partita di basket, per ora`) | `Scrivi campo e ora: chi è in zona lo vede e si aggiunge.` + `Campi liberi qui intorno` con 2 campi; con filtro sport, sotto il kicker: `Ci sono partite di altri sport.` | **`Dichiara la serata`** (primary) + `Dichiara una serata` in fondo se ci sono campi |
| **Nessun campo con questo nome** | query senza risultati | corpo del foglio, testa `Campi trovati 0` | `Nessun campo per «<query>»` | `Entro 25 km. La ricerca guarda il nome del campo, non l'indirizzo.` | `Cancella la ricerca` (secondary) |

- La vecchia riga «Nessun campo per «x» entro 25 km» sotto il campo **sparisce**: il
  conteggio sta nel chip, il raggio nella riga di contesto, la spiegazione nello stato
  vuoto. Un messaggio, non tre.
- La distinzione «niente nel raggio» / «niente per questo sport» (oggi due testi diversi in
  pagina) **sale nell'invito a foglio pieno**, dove c'è spazio: a striscia resta la stringa
  approvata `Nessuna partita, per ora`. Il prototipo mostra la variante neutra; con lo sport
  attivo è la stessa struttura con lo sport nel kicker.
- La vecchia empty della pagina («Nessuna lobby qui intorno. Sii il primo.» + icona) **si
  cancella**: la sostituisce l'invito del foglio approvato. Insieme a lei sparisce
  «Prova con un altro nome o sposta la mappa»: a foglio pieno la mappa non si vede, e la
  ricerca è per raggio, non per viewport — quel consiglio era sbagliato.
- Lo stato **«nessun campo in quest'area»** (browse: 0 campi nel viewport) resta un
  messaggio della mappa, non del foglio: non si fonde con questi tre. Vedi «Fuori lane».
- Errore di rete ≠ vuoto: card `--danger` con `Ricerca non riuscita` / `Controlla la
  connessione e riprova.` / `Riprova`. Mai `role="alert"`: una ricerca fallita non è
  un'emergenza, la annuncia la live region educata.

## Stati

Un solo elenco alla volta. `stato ricerca` ∈ `off | loading | results | empty | error`.

| Stato | Testa del foglio | Corpo | Live region (polite) |
|---|---|---|---|
| `off` (query vuota) | `Partite vicine` + chip n + `Oggi, lunedì 16 novembre · entro 5 km` + chevron | striscia + elenco partite (+ vuoto partite) | `Lista ridotta a striscia. 5 partite vicine.` (o a tutta altezza) |
| `loading` | `Campi trovati`, chip nascosto, `Cerco «villa»…` | 3 skeleton 80px, `aria-hidden` | `Cerco «villa» entro 25 km.` |
| `results` | `Campi trovati` + chip n, `entro 25 km` | righe campo (foto 56, nome, `a 1,2 km · Basket · Parco`) | `3 campi per «villa» entro 25 km.` |
| `empty` | `Campi trovati` + chip `0`, `entro 25 km` | stato vuoto sopra | `Nessun campo per «campetto azzurro» entro 25 km. La ricerca guarda il nome del campo, non l'indirizzo.` |
| `error` | `Campi trovati`, chip e contesto nascosti | card errore | `Ricerca non riuscita per «villa». Controlla la connessione e riprova.` |

La testa non è una live region (il testo cambia insieme ai risultati: un solo annuncio,
quello della live region). Il chip del conteggio resta `aria-hidden` come nel prototipo
approvato.

## Copy definitivo

| Chiave | Testo |
|---|---|
| Placeholder campo | `Cerca un campo per nome…` |
| Label accessibile campo | `Cerca campi per nome` |
| Bottone cancella (aria) | `Cancella la ricerca` |
| Titolo ricerca | `Campi trovati` |
| Contesto ricerca | `entro 25 km` |
| Stato in corso | `Cerco «{query}»…` |
| Vuoto ricerca | `Nessun campo per «{query}»` / `Entro 25 km. La ricerca guarda il nome del campo, non l'indirizzo.` / `Cancella la ricerca` |
| Errore | `Ricerca non riuscita` / `Controlla la connessione e riprova.` / `Riprova` |
| Ricerca chiusa | `Ricerca chiusa. Partite vicine. {n} partite vicine.` |
| Meta riga risultato | `a 1,2 km · Basket · Parco` (distanza · sport · tipo di luogo) |

Il placeholder usa i puntini di sospensione tipografici (`…`), non tre punti.
Il nome accessibile della riga è la frase intera (`Campetto Villa Chigi, a 1,2 km,
basket, parco`), non il testo troncato a schermo.

## Misure

Frame 360×720 del prototipo; a 390×664 (iPhone 13) i valori di chrome e righe sono gli
stessi, cambia solo lo spazio del foglio.

| Elemento | Valore | Note |
|---|---|---|
| Chrome, bordo inferiore | **112px** | 12 + 44 (filtri) + 8 (gap) + 48 (campo) |
| Campo di ricerca | **336×48** (a 360) | `min-height: 48`, raggio 10, icona 18 |
| Input dentro il campo | **46px** | 16px di font (niente zoom iOS) |
| Bottone × | **44×44** | dentro il campo, a destra |
| Distanza chrome → foglio a piena | **8px** | la mappa si vede in una fessura: il foglio non tocca la barra |
| Foglio pieno | `altezza − nav − 112 − 8` | 544 a 360×720, 488 a 390×664, 244 con tastiera 300 (nel frame del prototipo, che ha 1px di bordo, si misurano 3px in meno) |
| Testa ricerca | **50px** | 14 (top) + 26 (titolo) + 10; 70 con la riga di contesto (`entro 25 km`) |
| Riga risultato | **82px** | min 80 + bordi; foto 56, gap 12, padding 12 |
| Striscia (invariata) | 144px | handle 44 + titolo 26 + 10 + striscia 64 |
| Righe visibili a piena, senza tastiera | ~4,5 (664) / ~6 (844) | 420px di lista a 664 |
| Righe visibili con tastiera 300 | ~2 (664) | 194px di lista; la lista scorre |

## Token e componenti

- **Campo**: `--bg-elevated`, `--border-strong`, `--radius-control`, ombra `0 4px 12px`
  come il selettore sport; focus = bordo `--accent` + anello `--focus-ring` (come gli
  input del progetto). Placeholder `--text-muted` (5,43:1 su elevated: AA); icona
  `--text-secondary`.
- **Non è** l'`Input` in-flow di `components/ui/input.md` (surface, bordo trasparente):
  è la variante «chrome sopra la mappa», registrata in `gaps.md`. Geometria e font sono
  gli stessi (16px, raggio 10), cambiano solo superficie e bordo.
- **Righe risultato**: riusano la riga di `CourtSearchResults` (foto 56, nome 16/600,
  meta 14 `--text-secondary`, `--radius-card`, `--bg-surface`), **senza barra dei posti e
  senza chevron**: la barra parla di una partita, il chevron promette un'altra schermata.
- **Testa**: Syne 20/600, chip come `sheet__count` (`--accent-subtle` + `--text-primary`),
  contesto 13 `--text-secondary`.
- **Vuoto**: icona 32 `--text-muted`, titolo Syne 20/600, corpo 15 `--text-secondary`,
  bottone `secondary` 44px. Nessuna CTA accent: l'accent resta a «Dichiara la serata».
- **Errore**: bordo `--danger`/40 e fondo `--danger`/10 sopra `--bg-elevated`, titolo
  `--danger-dark` (6,41:1), bottone secondary.

## Accessibilità

- **Ordine di tabulazione** = ordine visivo: mappa → selettore sport → campanello →
  campo di ricerca → handle → righe → nav. Il campo è un `<input>` con
  `<label class="sr-only">`, `type="search"`, `enterKeyHint="search"`, `autoComplete="off"`,
  `autoCorrect="off"`, `spellCheck={false}` (i nomi dei campi non si correggono da soli).
- **Invio** sul campo chiude la tastiera (la ricerca è già partita col debounce: 300ms di
  attesa dopo l'ultimo tasto); **Esc** chiude la ricerca.
- Una sola **live region** per la ricerca (polite) con i testi della tabella Stati. La
  testa del foglio non è live: nessun doppio annuncio.
- Target: campo 48, × 44×44, righe ≥82, bottone vuoto 44. Nessun controllo sotto i 44px.
- Il foglio resta **non modale** (`role="region"`, nessun backdrop, nessun focus trap):
  la ricerca non lo rende un dialog. Vedi `patterns/sheets.md` §«Sheet non modale».
- Contrasto: campo/testo `--text-primary` su `--bg-elevated` 12,42:1; placeholder 4,67:1
  (AA); errore `--danger-dark` su danger/10 + elevated 6,41:1 (AA).
- **axe-core: 0 violazioni** (WCAG 2.2 A/AA + best practice) su striscia+barra,
  risultati, vuoto, errore, tastiera, piena partite.

## iPhone / WebKit

- `100dvh` e ricalcolo delle altezze all'ingresso in schermo intero: già coperti da
  `npm run verify:webkit` sul prototipo (27/27, iPhone 13).
- Il foglio sopra la tastiera si calcola **solo** da `visualViewport`, mai da `dvh`:
  su iOS il viewport di layout non si accorcia. Ricalcolare su `visualViewport.resize` e
  `scroll`.
- La safe-area la porta la nav (`pb-safe`); senza tastiera il foglio è ancorato alla nav
  (`bottom: var(--nav-h)`), quindi segue l'inset da solo (verificato con
  `Emulation.setSafeAreaInsetsOverride`: il foglio sale di 34px con la nav).
- **Non verificabile in emulazione** (`docs/ios.md`): tastiera vera e sue animazioni,
  collasso della URL bar durante lo scroll, safe-area reale su WebKit, momentum. Il
  prototipo la simula (300px) per misurare le altezze, non per certificare il
  comportamento.

## Impatto sul codice (per @fixer, Lane B)

- `app/(app)/page.tsx`: il chrome diventa una colonna di due righe (filtri + campo); il
  foglio riceve `query`/`searchPhase` e la decisione «un solo elenco»; `full = available −
  chrome − 8`; `visualViewport` per la tastiera; `snapBefore` e ripristino dello scroll.
- `components/court/court-search.tsx`: diventa il campo flottante (perde la riga di stato;
  il conteggio vive nella testa del foglio). `court-search-results.tsx`: la riga si riusa
  nel foglio; se nessuno la usa più fuori, il componente si ritira.
- `components/home/lobby-sheet.tsx` (Lane B): nasconde handle e testa meta in ricerca,
  `inert` sul contenuto non attivo, `aria-live` unica.
- `docs/design/accessibility.md`: la riga «Campo di ricerca 328×54» diventa 336×48 quando
  la home è implementata.

## Fuori lane (conseguenze che qualcuno deve prendere in carico)

- **«Lista campi»** (`court-map.tsx`, oggi `bottom-4 start-3`): con il foglio a
  striscia finisce sotto di lui. Va ancorato sopra il bordo del foglio (come FAB e
  anteprima) o spostato nel foglio: non è ricerca, ma la home nuova lo rende invisibile.
- **Banner «Nessun campo in quest'area»** (`page.tsx`, blocco `noCourtsForSport`): stesso problema, stessa
  soluzione (sopra il foglio, nascosto a piena).
- **Placeholder e raggi**: il campo dice `entro 25 km` ma la ricerca parte dal **centro
  mappa** (`selectSearchOrigin`), non da «qui»: se in futuro il copy diventa «qui
  intorno» va cambiata anche l'origine.

## Verifiche fatte

- `npm run verify:webkit` → **27/27** (WebKit locale, iPhone 13 + 360×800; safe-area via
  Chromium/CDP).
- 44 check Playwright sul prototipo (360×800, touch reale): geometria (chrome 112/113 col
  bordo del frame, foglio a 8px dal chrome, 0 overflow), focus→piena, digitare→risultati,
  un solo elenco, × → snap di prima + focus sull'handle, snap «piena» conservato, scroll
  conservato, backspace→piena con lista, drag giù→chiusura, tastiera appoggiata al suo
  bordo, vuoto/errore/caricamento, **axe 0** su 6 stati, console pulita.
- 10 check WebKit con profilo iPhone 13 su questi stessi punti (altezze, tastiera, prima
  riga sopra la tastiera, chiusura).
- Screenshot (artefatti locali, `qa/screenshots/` è gitignored):
  `11-ricerca-striscia`, `12-ricerca-risultati`, `13-ricerca-vuota`,
  `14-ricerca-tastiera`, `15-ricerca-errore`, `16-piena-sotto-la-barra`,
  `17-webkit-iphone13-ricerca`.
