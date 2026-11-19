# Review — email di autenticazione (#86)

Data: 19 novembre 2026. Perimetro: i cinque template in
`supabase/auth/templates/`, gli oggetti in `supabase/config.toml` e il test
`tests/unit/auth-templates.test.ts`. SMTP, dominio e prove di consegna stanno
in [`docs/email.md`](../../email.md), non qui.

## Verdetto

**Restare scuri.** Il dark è già l'identità del prodotto e, con
`color-scheme: only dark` e i `bgcolor` espliciti, i client che rispettano lo
schema non applicano la loro inversione. Il chiaro non è più sicuro, è solo
più anonimo: Outlook.com e Gmail ricolorano anche le mail chiare, e il primo
contatto perderebbe l'unico segnale che lo lega all'app.

I template sono pronti per un invio di prova dopo le correzioni sotto. Non
sono stati provati su Outlook, Gmail e Apple Mail reali: le correzioni seguono
il comportamento noto dei client, la prova di consegna resta obbligatoria.

## Cosa è stato guardato

| Area | Esito |
|---|---|
| Struttura HTML | Tabelle, `role="presentation"`, CSS inline, nessuna immagine, nessun font esterno |
| Larghezza | Card 480 px, sotto il massimo di 600. Outlook ignorava `max-width`: corretto |
| Dark mode | `color-scheme` dichiarava anche il tema chiaro: corretto in solo dark |
| Peso | 3,8–4,0 KB per file, nessuna richiesta esterna, sotto la soglia di clipping di Gmail (102 KB) |
| Variabili | Tutte quelle usate esistono in Supabase; nessun host cablato |
| Oggetti | Chiari e coerenti; nessun cambio necessario, dettagli sotto |
| Test | `npx vitest run tests/unit/auth-templates.test.ts`: 8/8 verdi |
| Lint design | `npm run lint:design`: verde (205 file). **Non copre `supabase/` né `docs/`** |

## Difetti corretti

Solo quelli che rompono la lettura o il click.

| # | Difetto | Effetto | Correzione |
|---|---|---|---|
| 1 | La card era `width="100%"` + `max-width:480px`; Outlook desktop ignora `max-width` | La card si allargava a tutta la pane di lettura, ben oltre 600 px, con righe lunghissime | `width="480"` + `style="width:480px;max-width:480px"`; sotto 520 px la card torna fluida con una media query (520 = 480 + i 16 px di padding per lato) |
| 2 | `color-scheme: dark light` | Dichiara che la mail supporta anche il tema chiaro: un client può applicare la propria conversione a un design che è solo dark | `only dark` nel meta e nel CSS, `supported-color-schemes: dark` |
| 3 | I fondi erano solo in CSS, senza `bgcolor` | Se un client toglie il CSS di sfondo, il testo chiaro resta su bianco e sparisce | `bgcolor` su `body`, tabella esterna, card e cella del pulsante |
| 4 | Il verde del pulsante stava solo sul `<td>` | Se il client toglie quel fondo, il testo `#141414` finisce sul fondo scuro e non si legge; il bottone perde anche il suo bersaglio visivo | Verde anche sull'`<a>`, `line-height:20px` e `mso-line-height-rule:exactly` (altezza 48 px) |
| 5 | L'URL di fallback era testo semplice, non un link | Non era cliccabile: su mobile bisognava selezionarlo e copiarlo a mano | `<a href="{{ .ConfirmationURL }}">` con sottolineatura, stesso URL assoluto del pulsante |
| 6 | Il padding esterno stava sulla `<table>` | Outlook lo applica in modo parziale: la card poteva restare attaccata al bordo | Padding spostato sulla `<td>` che centra la card |
| 7 | iOS Mail poteva riformattare il testo | Il layout a 360 px poteva cambiare da solo | `x-apple-disable-message-reformatting` e `text-size-adjust: 100%` |

Le correzioni 2–4 sono quelle che prevengono il caso "testo che sparisce":
non esiste un opt-out affidabile per la ricolorazione di Outlook.com, ma con
`color-scheme` e i colori anche negli attributi il messaggio resta leggibile
anche quando il client riscrive il CSS.

## Difetti trovati e lasciati com'erano

Sono reali, ma non rompono la lettura o il click: restano come debito
dichiarato, non come modifiche silenziose.

| # | Rilievo | Perché resta |
|---|---|---|
| 1 | Nessun preheader nascosto | Il primo testo nello snippet è "Drop-In" o l'inizio del corpo. Non è un errore di rendering; è una riga da aggiungere quando si tocca il copy |
| 2 | `{{ .Token }}` è mostrato in confirmation e recovery, ma l'app non ha un campo per inserire il codice (`verifyOtp` non esiste in `app/`, `components/`, `lib/`) | Promette un'alternativa che oggi non si può usare. O si toglie il blocco, o si aggiunge l'input nell'app: è una decisione di prodotto, non di template |
| 3 | L'invito dice "C'è un account pronto per …" | Prima dell'accettazione l'account non esiste; la frase è imprecisa. Va riscritta con calma, insieme al copy della beta |
| 4 | La firma dice solo "Drop-In · Street Edition" | Chi non conosce il prodotto non scopre cosa fa. Manca la riga "chi gioca, dove, adesso" |
| 5 | Recovery e magic link dicono "Scade tra un'ora" | La scadenza non è configurata in `config.toml`; il default di Supabase può non essere un'ora. Meglio "il link scade e vale una sola volta" |
| 6 | Nessun indirizzo postale, nemmeno come segnaposto | Per la beta chiusa non è bloccante; prima di un invio ampio serve un posto dichiarato nel footer |
| 7 | Oggetto dell'invito: "Invito a Drop-In" | È chiaro ma generico. "Il tuo invito a Drop-In" è più personale; cambio cosmetico, non necessario |
| 8 | Card da 480 px invece di 600 | Non è un difetto: 480 è la misura giusta per 60–90 parole e sta sotto il massimo. Allargarla allunga le righe senza aggiungere niente |
| 9 | I pulsanti a pillola diventano quadrati in Outlook | Degrado accettato: il colore e il testo restano, il click funziona |
| 10 | `{{ .SiteURL }}` non è usato | Corretto: l'URL pubblico non serve a nessuna delle cinque azioni e in locale sarebbe `localhost` |
| 11 | Nessuna versione plain-text | Supabase carica solo HTML da `content_path`; non è gestibile da questi file |
| 12 | `{{ .Email }}` in `email_change` | La doc Supabase non è esplicita sul vecchio indirizzo in questo template. Il copy lo dà per vecchio: da confermare con un invio reale, soprattutto se si abilita il secure email change (due email, due destinatari) |

## Bloccanti fuori dai template

Non li ho toccati, ma vanno chiusi prima di mandare gli inviti della beta.

1. **Dove atterra `{{ .ConfirmationURL }}`.** L'unico scambio del codice è in
   `app/api/auth/callback/route.ts`. Il middleware fa solo `getUser`, non
   scambia un eventuale `?code`. Se l'invito parte dalla dashboard Supabase
   senza un `redirect_to` esplicito verso `/api/auth/callback`, il link porta
   su `/` e la sessione non viene creata. Da provare con un invito vero prima
   di aprire la beta.
2. **Dopo il reset non c'è una schermata per scegliere la nuova password.**
   Non esiste una chiamata a `updateUser` né una route di reset: il pulsante
   "Scegli una nuova password" porta a un vicolo cieco. Il template è corretto,
   il flusso no.
3. **Template locale e template hosted sono due copie.** Modificare questi
   file non aggiorna staging e produzione: vanno incollati nella dashboard
   (Auth → Email Templates) o passati da un `config push` minimo. Vedi
   `docs/email.md` §4.

## Oggetti e variabili

| Tipo | File | Oggetto | Variabili |
|---|---|---|---|
| `invite` | `invite.html` | Invito a Drop-In | `.ConfirmationURL`, `.Email` |
| `confirmation` | `confirmation.html` | Conferma il tuo indirizzo email · Drop-In | `.ConfirmationURL`, `.Email`, `.Token` |
| `recovery` | `recovery.html` | Reimposta la password · Drop-In | `.ConfirmationURL`, `.Email`, `.Token` |
| `magic_link` | `magic-link.html` | Il tuo link di accesso · Drop-In | `.ConfirmationURL`, `.Email` |
| `email_change` | `email-change.html` | Conferma il nuovo indirizzo · Drop-In | `.ConfirmationURL`, `.Email`, `.NewEmail` |

- Tutti i link sono assoluti: `{{ .ConfirmationURL }}` è generato da Supabase
  e contiene già host e token. Nessun host è cablato (il test lo impone).
- `.SiteURL`, `.TokenHash` e `.RedirectTo` non servono in questi template.
- `.Token` è presente solo in confirmation e recovery. Vedi il rilievo 2.

## Misure e contrasti

| Voce | Valore |
|---|---|
| Larghezza card | 480 px (massimo dichiarato 600) |
| Larghezza contenuto | 424 px desktop; 272 px a 360 (card fluida, padding 28) |
| Pulsante | 48 px di altezza, un solo pulsante primario per email |
| Tipografia | h1 22/1.3; body 15/1.6; meta 12/1.5. Font di sistema, nessun webfont |
| Peso | 3,8–4,0 KB per file |

Contrasti calcolati (WCAG 2.x):

| Coppia | Rapporto | Esito |
|---|---|---|
| `#141414` su `#24ae56` (testo del pulsante) | 6,37:1 | AA |
| `#24ae56` su `#1e1e1e` (eyebrow e link) | 5,77:1 | AA |
| `#c9c9c9` su `#1e1e1e` (body) | 10,07:1 | AA |
| `#a3a3a3` su `#1e1e1e` (meta e footer) | 6,61:1 | AA |
| `#f0f0f0` su `#1e1e1e` (titoli) | 14,63:1 | AAA |

## Come si prova

```bash
# 1. I template esistono, sono coerenti e config punta a loro
npx vitest run tests/unit/auth-templates.test.ts

# 2. Guardrail design (non copre questi file: vedi sopra)
npm run lint:design

# 3. Anteprima dei file reali, 600 px e 360 px
python3 -m http.server 4173 --bind 127.0.0.1 --directory .
# poi: http://127.0.0.1:4173/docs/design/emails/anteprima.html
```

Verifica su WebKit (motore Safari, profilo iPhone):

```bash
# la variabile URL, non --url: lo script antepone il default e il flag
# documentato viene ignorato
URL=http://127.0.0.1:4173/docs/design/emails/anteprima.html npm run verify:webkit
# 6/6 PASS: overflow, font locali, console. Non è un client email.
```

Screenshot locali (gitignored): `qa/screenshots/emails/`, 360 e 600 px per
ognuno dei cinque template più l'anteprima. `npm run lint:design` resta verde
ma non legge questi file: non è una prova dei template.

Per la prova di consegna vera usare `docs/email.md` §5
(`npm run email:smoke`) e aprire il link ricevuto. Non basta che l'HTML si
veda bene nel browser: il link deve creare la sessione e, per la recovery,
portare a una schermata che aggiorna la password.

Matrice minima prima della beta:

| Client | Cosa guardare |
|---|---|
| Outlook Windows (classico) | Card 480 px e centrata, non a tutta pane; pulsante verde con testo scuro; URL che va a capo |
| Outlook.com, tema scuro | Nessun testo chiaro su fondo bianco; il pulsante resta verde; nessuna card invisibile |
| Gmail web e Android | Stessa card; il link di fallback è cliccabile; niente riquadro "promozioni" per contenuto (non dipende dallo sfondo) |
| Apple Mail iOS, tema scuro | Testo leggibile, nessun ingrandimento automatico anomalo, link apribile |
| Tutti | Oggetto, nome mittente, un solo pulsante, URL di fallback cliccabile |

Nota di onestà: qui non c'è un client email reale. Il giro è stato fatto su
WebKit con la pagina di anteprima, non su Outlook/Gmail/Apple Mail. Le
correzioni sono conservative e basate sul supporto noto, ma la prova di
consegna su un invito vero resta il criterio di done.

## File toccati

- `supabase/auth/templates/invite.html`
- `supabase/auth/templates/confirmation.html`
- `supabase/auth/templates/recovery.html`
- `supabase/auth/templates/magic-link.html`
- `supabase/auth/templates/email-change.html`
- `docs/design/emails/review.md` (questo file)
- `docs/design/emails/anteprima.html` (anteprima, non è un template)
