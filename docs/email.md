# Email di autenticazione

Stato al 2026-11-16 (Phase 4B, lane email, #86). Template brandizzati e
runbook; l'invio reale su staging richiede un dominio e credenziali SMTP, che
non stanno nel repo.

## Decisione: SMTP dedicato per staging/prod, built-in solo in locale

| Opzione | Pro | Contro | Verdetto |
|---|---|---|---|
| Supabase built-in | zero setup | **2 email/ora per progetto**, nessun controllo su deliverability, IP condiviso, pensato per i test | solo dev locale |
| **Resend** (preferita) | 3.000/mese e 100/giorno free, SMTP + API, DKIM 1 click, ottima DX | richiede dominio verificato per "from" proprio | staging/prod |
| Brevo | 300/giorno free, SMTP, marketing incluso | pannello più pesante, deliverability variabile | fallback |
| Postmark | deliverability top | 100/mese di prova, poi a pagamento | non giustificato |

Regola operativa: in locale si resta su **Mailpit** (`http://127.0.0.1:54334`,
`[local_smtp]`), in staging/prod si configura un provider dedicato e si alza
`rate_limit_email_sent` sopra il default. I numeri dei piani free cambiano:
verificarli al momento dell'attivazione.

Perché non lasciare il built-in in produzione: 2 email/ora rendono di fatto
impossibile il reset password (bastano due richieste per bloccare tutti), e
l'errore che vede l'utente è un generico "email rate limit exceeded".

## Template

Sorgente di verità per il dev locale: `supabase/config.toml`
(`[auth.email.template.*]`) + `supabase/auth/templates/*.html`.

| Tipo | File | Variabili usate |
|---|---|---|
| `confirmation` | `confirmation.html` | `.ConfirmationURL`, `.Email`, `.Token` |
| `recovery` | `recovery.html` | `.ConfirmationURL`, `.Email`, `.Token` |
| `magic_link` | `magic-link.html` | `.ConfirmationURL`, `.Email` |
| `email_change` | `email-change.html` | `.ConfirmationURL`, `.Email`, `.NewEmail` |
| `invite` | `invite.html` | `.ConfirmationURL`, `.Email` |

Vincoli dei template (verificati da `tests/unit/auth-templates.test.ts`):

- italiano (`<html lang="it">`), tema dark dell'app (#141414 / #1e1e1e) con
  accent #24ae56, bottoni che sono link con stile inline: niente immagini
  remote, niente font esterni, niente host cablati.
- Ogni email ha il link e il codice OTP a 6 cifre (dove previsto) e una riga
  "se non hai chiesto tu, ignora".
- Table-based layout 480 px, `color-scheme: dark light` per Gmail/Apple Mail.

Su un progetto hosted il pannello **Auth → Emails** resta la fonte di verità:
`supabase config push` copre solo parte di `[auth]`. Quando si cambia un
template qui, va riportato anche nel pannello di staging e prod (o si genera
lo snippet dal file).

## Setup per ambiente

### Locale (già fatto)

`supabase start` legge `config.toml` e serve i template a GoTrue via Kong
(`GOTRUE_MAILER_TEMPLATES_*`). Le email finiscono in Mailpit.

Verifica end-to-end (nessuna credenziale):

```bash
curl -s -X POST http://127.0.0.1:54321/auth/v1/recover \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"email-lane@dropin.test"}'
curl -s http://127.0.0.1:54334/api/v1/messages
curl -s http://127.0.0.1:54334/api/v1/message/<ID> | jq -r .HTML
# atteso: oggetto "Reimposta la password · Drop-In", accent #24ae56,
# link http://127.0.0.1:54321/auth/v1/verify?token=...&type=recovery,
# codice a 6 cifre nel corpo
```

Eseguito il 2026-11-16: oggetto, brand, link `type=recovery` e codice
presenti nel messaggio renderizzato da GoTrue.

### Staging e produzione

1. **Dominio mittente.** Serve un dominio (es. `drop-in.app`) con un
   sottodominio di invio (`mail.drop-in.app`). Il from sarà
   `noreply@mail.drop-in.app`.
2. **Provider.** Creare il progetto su Resend, aggiungere il dominio, copiare
   i record DNS proposti e attendere la verifica (SPF, DKIM; DMARC se il
   dominio principale non ne ha uno).
3. **Credenziali SMTP** (Resend: host `smtp.resend.com`, porta `587` STARTTLS,
   user `resend`, password = API key). Inserirle **solo** nel pannello
   Supabase del progetto (Auth → SMTP Settings), non nel repo e non in
   `.env.example`.
4. **Mittente e nome**: `noreply@mail.drop-in.app`, `Drop-In`.
5. **Rate limit email**: alzare il limite di invio (il pannello Auth → Rate
   Limits; il default con SMTP custom è più alto di 2/h ma va deciso in base
   al provider).
6. **Redirect URL** per progetto (Auth → URL Configuration):
   - staging: `https://drop-in-stage.vercel.app/**` e
     `https://*-andrea-fioris-projects-14d416c7.vercel.app/**`
   - prod: `https://drop-in-rho.vercel.app/**`
   - `site_url` = alias stabile dell'ambiente (non il per-preview).
   Questi valori sono già documentati in `docs/staging.md`; il pannello resta
   la verifica finale.
7. **Template**: incollare i 5 file HTML nel pannello (o verificare che i
   `content_path` siano supportati dal `config push` della CLI usata).
8. **Prova**: registrazione + conferma, reset password, magic link. Controllare
   in Resend → Emails che lo stato sia `delivered`, non solo `sent`.

## Deliverability

- SPF: un solo record, include il provider (`v=spf1 include:_spf.resend.com -all`
  o quello indicato dal provider). Due record SPF = fallimento.
- DKIM: record forniti dal provider, verificati.
- DMARC: iniziare con `v=DMARC1; p=none; rua=mailto:dmarc@…`, poi stringere.
- From e Return-Path sullo stesso dominio di invio: Gmail penalizza i mismatch.
- Niente allegati, niente immagini remote, HTML leggero: i template attuali
  rispettano già questi vincoli.
- Se le email finiscono in spam: controllare prima DKIM/DMARC, poi il
  contenuto (link shortener, mai).

## Limiti e cose da sapere

- Il rate limit email di Supabase è **per progetto**, non per utente: un
  attaccante che chiede reset per email diverse consuma la quota di tutti.
  Con SMTP dedicato il limite si alza, ma resta un motivo per tenere il
  rate limit applicativo sui reset (vedi `docs/security.md`: oggi non c'è,
  l'auth non passa dal nostro DB).
- Mailpit non consegna nulla fuori dalla macchina: in locale i test
  "l'utente riceve l'email" vanno fatti leggendo Mailpit, non la casella.
- I secret SMTP non vanno in `.env.local` condivisi né nei log; `docs/logging.md`
  vieta già host/key nei log. Idem per le API key del provider.

## Verifica

| Cosa | Comando/file |
|---|---|
| Template esistono, sono coerenti, config punta a loro | `npx vitest run tests/unit/auth-templates.test.ts` |
| GoTrue rende i template davvero | recupero password su Mailpit (comando sopra) |
| Nessuna regressione auth | `E2E_WITH_DB=1 npx playwright test --project=e2e` (login/registrazione) |

## Aperti (richiedono l'utente)

- Dominio mittente e DNS (SPF/DKIM/DMARC): servono accesso al registrar.
- Account provider + API key SMTP: da inserire nel pannello Supabase, mai qui.
- Invio reale su staging e prova deliverability: dopo i due punti sopra.
- Alzare `rate_limit_email_sent` a un valore deciso (proposta: 30/h con SMTP
  dedicato, monitorando i bounce).
