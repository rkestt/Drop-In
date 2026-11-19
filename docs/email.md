# Email transazionale (#86)

Runbook operativo per dare a Drop-In un SMTP dedicato con dominio
autenticato. **Nessuna credenziale reale vive in questo file né nel repo**:
host, utenti e password si incollano solo nella Dashboard Supabase.

Stato di partenza (nov 2026):

- Supabase integrato: **max 2 email/ora**, non pensato per la produzione
  (conferme e reset possono sparire o finire in spam).
- Su **staging le conferme email sono disattivate** (la signup logga subito);
  per qualunque prova di consegna vanno riabilitate temporaneamente.
- In **locale** le email finiscono in **Mailpit** (`http://localhost:54334`):
  nessun invio reale, nessun costo.
- I template brandizzati esistono già in `supabase/auth/templates/`
  (confirmation, recovery, magic-link, email-change, invite).

## 1. Scelta del provider

Requisiti: SMTP relay standard (Supabase parla solo SMTP, niente API
proprietarie), piano gratuito che copra la beta chiusa, autenticazione del
dominio con SPF + DKIM + DMARC.

| | **Resend** | **Brevo** | **Postmark** |
|---|---|---|---|
| Piano gratuito | $0: **3.000/mese, max 100/giorno**, 3 domini | Piano Free $0: **da verificare** (storicamente 300/giorno) | Trial $0: **100/mese**, senza scadenza |
| Carta richiesta sul free | **da verificare** (iscrizione via email/GitHub) | **da verificare** | **No** ("No Credit Card Required" sulla pagina prezzi) |
| Offerta studenti | **No**: dichiara "no education pricing"; sconto 50% solo nonprofit registrate | **da verificare** | Nessuna per studenti; credito $75 solo per bootstrapped già lanciate |
| Primo piano a pagamento | $20/mese (50k email) | **da verificare** | $15/mese (10k email) |
| Auth dominio | DKIM + SPF + DMARC, anche sul free | Codice Brevo + DKIM + SPF (record esatti in dashboard) | DKIM + SPF Return-Path (record esatti in dashboard) |
| SMTP relay | Incluso anche sul free | Incluso (relay + API) | Incluso |

Fonti (verificate il 2026-11-19, i piani cambiano: **ricontrolla i numeri
prima di decidere**):

- Resend: https://resend.com/pricing (free 3.000/mese con tetto 100/giorno,
  3 domini, SMTP relay e DKIM/SPF/DMARC inclusi; niente education pricing,
  sezione FAQ).
- Postmark: https://postmarkapp.com/pricing (trial 100/mese senza scadenza,
  "No Credit Card Required"; Basic $15/mese per 10k; credito $75 bootstrapped,
  sezione FAQ).
- Brevo: https://www.brevo.com/pricing (piano Free a $0 confermato dallo
  schema della pagina, ma i **numeri del free non sono estraibili dalla
  pagina** — quota e carta **da verificare** in dashboard al momento
  dell'iscrizione).
- Limiti Supabase: https://supabase.com/docs/guides/auth/rate-limits
  (built-in 2 email/ora; con SMTP dedicato il rate limit è configurabile) e
  https://supabase.com/docs/guides/auth/auth-smtp (campi SMTP in dashboard).

Indicazione: per una beta chiusa (decine di inviti/settimana) **Resend free**
è il candidato naturale (tetto giornaliero noto e dominio autenticabile senza
carta secondo la doc — verifica l'ultimo punto in iscrizione). Postmark è il
piano B se la deliverability su Gmail/Outlook risulta migliore nei test:
100/mese bastano per la prova, non per la beta.

## 2. DNS: SPF, DKIM, DMARC

Il provider, dopo aver aggiunto il dominio mittente (es. `drop-in.app`),
mostra **i record esatti** da creare — i valori sotto sono segnaposto, vanno
sostituiti con quelli della dashboard del provider. Regola: non inventare
valori, copia quelli mostrati.

**SPF** — TXT sul dominio che invia (di solito un sottodominio tipo
`mail.drop-in.app`, oppure l'apex se mandi da lì):

```dns
mail.drop-in.app.   TXT   "v=spf1 include:<include-del-provider> ~all"
```

Un solo record SPF per nome: se ne esiste già uno, aggiungi l'include a
quello invece di crearne un secondo.

**DKIM** — TXT sul selettore indicato dal provider:

```dns
<selettore>._domainkey.drop-in.app.   TXT   "v=DKIM1; k=rsa; p=<chiave-pubblica-del-provider>"
```

È il record che conta davvero per Gmail: senza DKIM allineato, "via"
o "on behalf of" e cartelle spam.

**DMARC** — TXT su `_dmarc.drop-in.app`. Parti morbido, inasprisci solo
quando i report dicono che è tutto allineato:

```dns
_dmarc.drop-in.app.   TXT   "v=DMARC1; p=none; rua=mailto:<tua-casella>@drop-in.app"
```

`p=none` **non protegge niente**: serve solo a ricevere i report (`rua`).
La policy vera è `p=quarantine` e poi `p=reject`, da alzare dopo 1–2
settimane di report puliti.

Verifica di propagazione (aspetta la TTL del provider DNS, poi):

```bash
dig +short TXT mail.drop-in.app
dig +short TXT <selettore>._domainkey.drop-in.app
dig +short TXT _dmarc.drop-in.app
```

e il pannello di verifica del provider (tutti e tre mostrano "verified"
solo a DNS propagato).

## 3. Configurazione su Supabase (staging e prod)

Percorso dashboard (stesso su entrambi i progetti):
**Dashboard → progetto → Authentication → SMTP** —
`https://supabase.com/dashboard/project/_/auth/smtp`
(rif: doc "Send emails with custom SMTP").

Campi da compilare (nomi esatti della doc):

| Campo dashboard | Valore |
|---|---|
| SMTP host (`smtp_host`) | quello del provider (lo mostra la sua dashboard al setup) |
| SMTP port (`smtp_port`) | `587` (STARTTLS; alternativa `465` se il provider la indica) |
| SMTP user (`smtp_user`) | utente relay del provider |
| SMTP password (`smtp_pass`) | password/chiave relay generata dal provider |
| Sender email (`smtp_admin_email`) | es. `noreply@drop-in.app` — deve stare sul dominio autenticato al §2 |
| Sender name (`smtp_sender_name`) | `Drop-In` |

Note:

- **Non esiste un campo reply-to** nelle impostazioni SMTP di Supabase: chi
  preme "rispondi" scrive al sender email. Usa un indirizzo monitorato
  (o che non riceve risposte con autoresponder che spiega dove scrivere).
- Rate limit: con il built-in sono 2/ora; con SMTP dedicato il limite è
  **configurabile in Authentication → Rate Limits**. Leggi il valore corrente
  lì e alzalo solo quanto serve alla beta (chiave `rate_limit_email_sent`
  se passi da `config.toml`/config push). Tienilo basso finché i template
  non sono verificati: un template rotto con limite alto spamma utenti veri.
- Ripeti la procedura su **entrambi** i progetti:
  staging (`ygnjqqgnxdmgpeeidkbn`) prima, prod (`jeuqmmiebzeqtdctmtzj`) solo
  dopo prova verde su staging. Mai copiare valori da un progetto all'altro a
  memoria: rileggi ogni campo.
- In **locale non si configura nulla**: `supabase/config.toml` lascia
  `[auth.smtp]` commentato e le email restano in Mailpit (:54334).

## 4. Template

I file arrivano dall'altra lane in `docs/design/emails/` e diventano i
cinque HTML in `supabase/auth/templates/` (già dichiarati in
`supabase/config.toml` come `[auth.email.template.*]` con `content_path`).

### Mappa tipo → file → variabili

Verificata sui file in `supabase/auth/templates/` (se l'altra lane li
ritocca, rigenera con `grep -o '{{ *\.[A-Za-z]* *}}' supabase/auth/templates/*.html`):

| Tipo (`config.toml`) | File | Subject | Variabili usate |
|---|---|---|---|
| `confirmation` | `confirmation.html` | Conferma il tuo indirizzo email · Drop-In | `{{ .ConfirmationURL }}` (bottone + fallback testuale), `{{ .Email }}`, `{{ .Token }}` (codice OTP alternativo) |
| `recovery` | `recovery.html` | Reimposta la password · Drop-In | `{{ .ConfirmationURL }}` (bottone + fallback testuale), `{{ .Email }}`, `{{ .Token }}` (codice OTP alternativo) |
| `magic_link` | `magic-link.html` | Il tuo link di accesso · Drop-In | `{{ .ConfirmationURL }}` (bottone + fallback testuale), `{{ .Email }}` (nessun `{{ .Token }}`) |
| `email_change` | `email-change.html` | Conferma il nuovo indirizzo · Drop-In | `{{ .ConfirmationURL }}` (bottone + fallback testuale), `{{ .Email }}` (vecchio), `{{ .NewEmail }}` (nuovo) |
| `invite` | `invite.html` | Invito a Drop-In | `{{ .ConfirmationURL }}` (bottone + fallback testuale), `{{ .Email }}` (nessun `{{ .Token }}`) |

Quando un link arriva rotto, questa è la mappa da cui partire: ogni template
ha il bottone su `{{ .ConfirmationURL }}` più l'URL in chiaro sotto
("se il bottone non funziona, copia questo indirizzo"); solo confirmation e
recovery offrono anche `{{ .Token }}` come codice OTP. Se il link punta
all'host sbagliato, la causa non è il template ma site_url/redirect del
progetto (vedi §7).

### Vincoli imposti dal test (`tests/unit/auth-templates.test.ts`)

- Italiano: `<html lang="it">` in tutti.
- Nessuna immagine remota (`<img>` vietato) e nessun font esterno
  (`@import`/`fonts.googleapis` vietati): i client email li bloccano.
- Nessun host cablato: niente `http://localhost` né `http://127.0.0.1`.
- Brand coerente col tema dark: `#24ae56` (accent) e `#141414` (sfondo)
  presenti in tutti; layout table-based.
- `config.toml` deve avere un blocco `[auth.email.template.<tipo>]` con
  subject non vuoto e `content_path` che punta al file esistente.

### Dove applicarli

- **Locale**: basta tenere i file nel repo — `supabase start`/`db reset`
  li usa via `content_path`.
- **Staging/prod (consigliato: dashboard)**: Authentication → Email
  Templates → incolla l'HTML di ogni file del repo. La dashboard resta la
  fonte di verità sui progetti hosted (come già annotato in `config.toml`).
- **Alternativa `config.toml`**: `supabase config push` con un file minimo
  che dichiara SOLO le proprietà modificate (mai pushare il `config.toml`
  del repo: contiene `localhost:3000` — vedi `docs/staging.md` §3).
  Verifica dopo il push che i subject in dashboard corrispondano.

Dopo ogni modifica, manda una prova vera (§5) e apri il link —
un template che renderizza ma col link rotto è peggio di nessun template.

## 5. Prova di consegna

Script: `scripts/smoke-email.sh` (`npm run email:smoke -- ...`). Manda un
invito (default) o una recovery via Auth Admin API al progetto indicato,
senza default che puntino alla produzione:

```bash
# Locale (finisce in Mailpit, nessun invio reale)
npm run email:smoke -- --url http://localhost:54321 --to test@example.com

# Staging (invio reale via SMTP configurato sullo staging)
SUPABASE_SERVICE_ROLE_KEY=... npm run email:smoke -- --url https://ygnjqqgnxdmgpeeidkbn.supabase.co --to <tua-casella>
```

La service role key resta in env, mai nel comando in chiaro né nel repo.
Lo script rifiuta di girare senza indirizzo, senza chiave, e contro la
produzione senza `--i-know-this-is-prod`.

Esito atteso: HTTP 200 con l'utente creato → controlla **tre posti**:
inbox, cartella **spam**, scheda **"Promozioni"** (Gmail). Per la #86 la
prova è completa con uno screenshot per Gmail, uno per Outlook, uno per
iCloud.

## 6. Checklist umana finale (in ordine)

1. Scegli il provider dopo aver **riverificato i numeri del free** in
   dashboard (soprattutto Brevo: quota e carta).
2. Registra il dominio mittente sul provider e copia i record DNS esatti.
3. Crea i TXT di SPF, DKIM, DMARC (`p=none` + `rua` alla tua casella).
4. Verifica con `dig` + pannello del provider: tutto "verified".
5. Compila i 6 campi SMTP sullo **staging**; riabilita temporaneamente le
   conferme email se servono alla prova.
6. `npm run email:smoke` verso staging → controlla inbox/spam/promozioni,
   apri il link del template, completa una signup.
7. Ripeti 5–6 con un secondo provider mailbox (Gmail + Outlook minimo;
   iCloud per chiudere la #86).
8. Solo a deliverability verde: ripeti 5–7 sulla **prod**.
9. Alza DMARC a `quarantine` dopo ~2 settimane di report puliti, poi `reject`.
10. Aggiorna questa pagina con provider scelto, data e limiti misurati.

Successo = invito/recovery che arriva in **inbox** (non spam) su Gmail e
Outlook, link del template funzionante, DMARC con `p` oltre `none` senza
report di fallimento.

## 7. Cosa va storto di solito

- **Spam nonostante SPF ok**: quasi sempre manca DKIM o non è allineato
  (dominio del selettore diverso dal From). Gmail mostra "via <relay>" o
  "on behalf of" quando il From non è autenticato: sintomo, non causa —
  la causa è il DKIM.
- **DMARC `p=none` che sembra a posto**: `none` non fa nulla, chiede solo
  report. Se nessuno legge la casella `rua`, è decorazione. E un record
  DMARC malformato (virgolette/parentesi copiate male) equivale a nessun
  DMARC: riverifica con `dig`.
- **Due SPF sullo stesso nome**: invalida entrambi. Un solo TXT per nome,
  con tutti gli include dentro.
- **Invito a un indirizzo che esiste già**: l'Admin API non crea un secondo
  utente e la chiamata fallisce — per riprovare usa un indirizzo fresco
  oppure manda una recovery. Stesso discorso se superi il rate limit
  (built-in 2/ora): aspetta o passa allo SMTP dedicato.
- **Template incollato ma link rotto**: `{{ .ConfirmationURL }}` dipende da
  site_url/redirect del progetto (staging.md §Auth): se il link punta a
  localhost dallo staging, il problema è la site URL, non il template.
- **"Funziona in locale"**: Mailpit accetta tutto e non filtra niente —
  la deliverability si prova solo con invii reali (§5).
