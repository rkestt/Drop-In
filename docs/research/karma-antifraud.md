# Anti-fraud per check-in GPS e sistema Karma

Ricerca applicata al codice di Drop-In Street Edition. Data: 2026-10-30.
Fonti in fondo; ogni affermazione non banale ha il riferimento `[n]`.

---

## 0. TL;DR — cosa fare, in ordine

| # | Intervento | Costo | Impatto |
|---|---|---|---|
| 1 | Fix del bug `lobby_id`: oggi **tutti** i partecipanti perdono -3 alla chiusura, anche chi ha fatto check-in | 1 riga SQL | Altissimo (fairness percepita) |
| 2 | Sganciare il ban dalla soglia: `karma < 50` + `remove_expired_bans` = **ban permanente di fatto** | ~20 righe | Alto |
| 3 | Validazione server-side seria: insert solo via RPC, client non scrive `lat/lng/accuracy` | ~40 righe | Alto |
| 4 | Rate limiting nel DB, non nel client (PostgREST è l'API: il client può bypassare tutto) | ~30 righe | Alto |
| 5 | Corroborazione sociale: check-in "verificato" solo con ≥2 utenti distinti vicini | ~50 righe | Alto (unico vero anti-spoof single-user) |
| 6 | Check euristici di plausibilità (velocità, jitter, ripetizione coordinate) | ~60 righe | Medio |
| 7 | Reporting modello Strava (flag reversibile) + strike ladder modello Niantic | ~1 migration | Medio |
| 8 | Appeal / human-in-the-loop (GDPR art. 22) | UI + tabella | Obbligatorio se banni automaticamente |
| 9 | Device attestation (Play Integrity / App Attest) | alto | Solo se arriva shell nativa |

Regola di fondo: **nessun segnale è decisivo da solo**. La letteratura su GPS spoofing è concorde: la detection affidabile è multi-segnale e cross-validata, non un flag booleano `[1][2][3]`.

---

## 1. Threat model: chi bara e perché (in *questa* app)

Il check-in non dà nulla di tangibile: +1 karma, cap a 100 (`increment_karma_on_check_in`). Il danno vero è **difensivo**: evitare il -3 da no-show. Quindi l'incentivo non è "farmare" ma "proteggersi", e questo cambia il design:

1. **No-show avoidance** — l'attaccante più probabile non è un bot, è l'utente normale che si è iscritto a una lobby e non vuole perdere 3 punti. Costo di attacco percepito: aprire Chrome DevTools → Sensors → location override (30 secondi, zero tool), oppure un'app di mock location.
2. **Multi-account** per gonfiare la lobby o per "testare" — banale con email temporanee; Supabase limita solo il rate di signup, non l'unicità `[4]`.
3. **False report** verso rivali/utenti migliori — pattern documentatissimo: Tadej Pogačar flaggato ripetutamente su Strava da anonimi, con risultati rimossi dalle leaderboard finché lo staff non annulla `[5]`. Se il report ha effetto immediato e nessun costo, è un'arma.
4. **Court report spam** (`court_reports`: broken_hoop/wet_court) per nascondere un campo o trollare — categoria `other` libera, zero rate limit, zero moderazione.

Nota importante: il modello di minaccia qui è **basso sforzo / basso skill**, non un attaccante con SDR. Le difese devono costare meno dell'attacco e non punire i falsi positivi (GPS in un parcheggio tra palazzi a Roma è *pessimo*: 20–50 m di errore sono normali).

---

## 2. Cosa garantisce davvero il codice attuale

- `check_ins.lat/lng/accuracy` sono **interamente client-controlled**. RLS verifica solo `auth.uid() = user_id` `[6]`; nessun campo è derivato da fonte attendibile.
- `enforce_check_in_distance` confronta la coordinata *dichiarata* con il campo, raggio 50 m. Un mock location che punta al centro del campo passa sempre.
- `accuracy` è auto-dichiarata e il client la usa per *bloccarsi da solo* (`MAX_ACCURACY = 20`, `check-in-sheet.tsx`). Un client malevolo manda `accuracy: 1`. Nessun valore è verificabile.
- `enforce_check_in_cooldown`: 5 minuti **per (user, court)**. Nessun limite globale giornaliero: N campi = N check-in = N punti karma.
- L'insert non passa `lobby_id` (unico punto di insert: `check-in-sheet.tsx:82`), ma `decrement_karma_on_missed_check_in` cerca `ci.lobby_id = NEW.id`. **Risultato: ogni partecipante risulta no-show a ogni chiusura di lobby.** È il bug di fairness più grave del sistema attuale, e non è anti-fraud: è un bug funzionale.
- `enforce_ban_on_low_karma` è `BEFORE UPDATE` e scatta solo se `banned_until IS NULL`. `remove_expired_bans` azzera il campo ogni ora → al primo update successivo del profilo il trigger **ri-banna**. Poiché `check_user_not_banned` blocca join/create lobby sotto 50, l'utente resta fuori per sempre. Il messaggio "7 giorni" è falso.
- `check_ins` è `SELECT` per tutti: le coordinate di tutti gli utenti sono pubbliche. Non è anti-fraud ma è un problema di privacy (e un dataset regalo per chi vuole profilare i pattern di X per spoofarlo).

---

## 3. GPS spoofing: cosa è realisticamente rilevabile

### 3.1 Web / PWA — non c'è nessun segnale client

La spec W3C è esplicita: *"The API itself is agnostic of the underlying location information sources, and no guarantee is given that the API returns the device's actual location"* `[7]`. Le fonti possono essere GPS, Wi-Fi, cell ID, **IP**, o input utente. `coords.accuracy` è definita come raggio al 95% di confidenza in metri `[7]` — è un numero che il client riporta, non una garanzia.

Quindi su web:
- non esiste `isMock`;
- `navigator.geolocation` legge quello che il browser decide, e il browser permette override (DevTools Sensors) e estensioni;
- un mock a livello OS (app "Mock Locations", che simulano anche piccole fluttuazioni per sembrare GPS reale `[8]`) è indistinguibile lato pagina.

**Conclusione: sul web si può solo fare detection server-side su pattern.** Qualsiasi controllo client è teatro.

### 3.2 Shell nativa (Capacitor / wrapper) — segnali OS, tutti aggirabili

Se in futuro il check-in passa da un'app nativa:

- **Android**: `Location.isMock()` (API 31+) sostituisce `isFromMockProvider()` deprecato `[9]`; in più `AppOpsManager` per vedere se un'app ha il permesso di iniettare posizione e `Settings.Secure` legacy. Limite noto e documentato: moduli Xposed/Magisk nascondono il flag, e il flag stesso è "not 100% reliable" per via della fusion logic di Google `[10][11]`.
- **iOS**: `CLLocationSourceInformation.isSimulatedBySoftware` (iOS 15+) è l'unico segnale pubblico; **non esiste API pubblica per leggere il Developer Mode**, quindi i tool di spoofing restano difficili da distinguere `[12]`.
- In entrambi i casi: nessuna delle due piattaforme permette di disattivare programmaticamente mock/developer mode `[12]`.

### 3.3 Device attestation (opzionale, costoso)

- **Google Play Integrity**: `MEETS_DEVICE_INTEGRITY` (device certificato; su Android 13+ prova hardware-backed di bootloader bloccato e OS certificato), `MEETS_STRONG_INTEGRITY` (aggiunge patch di sicurezza recenti); il verdetto è vuoto in presenza di hooking/root/emulatore `[13]`.
- **Apple App Attest / DeviceCheck** per iOS.
- Da valutare **solo** se il check-in diventa un requisito d'accesso con valore reale. Oggi sarebbe over-engineering: nessun premio economico, e l'attestazione non dice nulla sulla *posizione*, solo sull'integrità del device.

### 3.4 Segnali comportamentali che sopravvivono allo spoofing

Questi sono l'unica difesa sensata per una PWA. Tutti calcolabili in SQL sul DB.

| Segnale | Definizione operativa | Perché funziona | Falsi positivi |
|---|---|---|---|
| **Velocità implicita** | Tra due check-in consecutivi: `max(0, d - acc1 - acc2) / Δt` (distanza in metri, corretta con l'errore dichiarato). Se > 60 km/h e Δt < 10 min → flag | Teleport = firma classica dello spoofing `[14]`; la correzione con `accuracy` evita i falsi positivi da drift | Bassa (auto/treno) → serve contesto |
| **Coordinate identiche** | `lat/lng` ripetuti a 6 decimali su check-in diversi, o varianza < 1 m su letture ravvicinate | Il GPS reale non è mai fermo al millimetro; gli spoofer devono *simulare* il rumore `[8]` | Molto bassa |
| **Accuracy sospetta** | `accuracy` sempre identica (es. 5.0, 5.0, 5.0) o < 3 m indoor/urban canyon | `accuracy` è al 95% `[7]`: in città valori ottimistici costanti sono innaturali | Media: non usare da solo |
| **Corroborazione** | Nessun altro utente distinto entro 100 m nella stessa finestra di 40 min | Un solo spoofer non può popolare il campo; un utente reale sì | Media a campo vuoto → usare come *peso*, non come blocco |
| **Coerenza IP/ASN** | IP del check-in vs regione del campo | Richiede cattura IP server-side (`request.headers` in Edge Function) | Media (VPN/CGNAT) |
| **Età account / storico** | Account < 24 h o < 3 check-in totali | Attacchi Sybil costano poco ma costano *tempo* `[15]` | Bassa come peso |
| **Firma del device** | Fingerprint leggero (UA + timezone + lingua + screen) ripetuto su più account | Multi-account è attacco #2 `[16]` | Media (privacy!) |

Nota metodologica: la letteratura fa cross-validazione tra fonti indipendenti (IMU vs GNSS, celle vs Wi-Fi) con test di consistenza stile RAIM `[1][2][3]`. Su web **non hai fonti indipendenti**: hai solo la storia del tuo DB. Quindi il modello giusto non è "rilevare lo spoof", è **"assegnare un livello di fiducia al check-in"**.

Formula suggerita (pesi da tarare, non definitivi):

```
risk = 3*velocity_impossible + 2*coords_repeated + 2*no_corroboration_recent
     + 1*accuracy_anomaly + 1*ip_region_mismatch + 1*account_new
```
- `risk >= 2` → check-in marcato `unverified`: karma **non** incrementato, ma nessuna penalità.
- `risk >= 5` → `unverified` + riga in `fraud_signals` per review umana.
- **Mai** bloccare l'utente in tempo reale su un euristico: l'errore GPS è la norma, e un blocco ingiustificato su un'app di quartiere costa più dell'utente che bara.

---

## 4. Rate limiting

### 4.1 Il vincolo architetturale

Con Supabase + PostgREST il client parla **direttamente** col DB con la anon key. Qualsiasi rate limit scritto in `check-in-sheet.tsx` è decorativo: l'attaccante chiama `POST /rest/v1/check_ins`. Il rate limit deve stare:

1. **nel DB** (trigger `BEFORE INSERT`), per tutto ciò che è business logic;
2. **nel platform layer** per auth (Supabase ha già limiti: 360 OTP/h, 30 sign-in anonimi/h per IP, 15 challenge MFA/min, CAPTCHA su signup/signin/reset) `[4]`;
3. **all'edge** (Cloudflare/Edge Function) solo per anti-flood, non per business rules `[17]`.

### 4.2 Algoritmo

- **Token bucket** per i burst legittimi (l'utente apre l'app, riprova dopo un errore): due numeri, O(1), permette raffiche controllate `[18][19]`.
- **Sliding window / conteggio esatto** quando il limite deve essere spiegabile all'utente ("hai già fatto 3 check-in oggi") `[19]`.
- Per Drop-In basta il conteggio esatto: i volumi sono minuscoli, e la chiarezza vale più dell'eleganza.

**Race condition da evitare**: due insert concorrenti leggono lo stesso count e passano entrambi. Serve serializzazione per utente — `pg_advisory_xact_lock(hashtext(NEW.user_id::text))` all'inizio del trigger, oppure `SELECT count(*) ... FOR UPDATE` sulla riga di profilo.

### 4.3 Budget proposti

| Azione | Limite | Motivazione |
|---|---|---|
| check-in stesso campo | 1 / 30 min | Check-in reale dura un'ora; 5 min è troppo permissivo |
| check-in totali | 4 / giorno, 12 / settimana | Copre un utente molto attivo (1–2 partite/giorno) |
| join lobby | 3 / ora, 10 / giorno | Anti-flood su `lobby_participants` |
| create lobby | 2 / giorno | Anti-spam |
| court report | 3 / giorno, 1 per campo / 12 h | Anti-brigading |
| segnalazione utente | 3 / giorno, 1 per target / 7 giorni | Vedi §6 |
| signup | CAPTCHA + 1 account per device fingerprint | Anti-Sybil `[15]` |

Risposta: errore Postgres con `SQLSTATE 53400` (configuration_limit_exceeded) o `P0001` con messaggio leggibile, e il client traduce in 429 + `Retry-After`. Hard-block silenzioso o 503 sono anti-pattern: il client non sa quando riprovare e ritenta a caso `[18]`.

### 4.4 Insert solo via RPC

Revocare `INSERT` su `check_ins` ad `authenticated` e passare da una funzione:

```sql
create schema if not exists private;

create or replace function private.check_in(
  p_court_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_dist double precision;
begin
  -- 1. rate limit (advisory lock per serializzare l'utente)
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  -- ... count(*) con finestre §4.3 ...

  -- 2. distanza con indice spaziale
  select st_distance(c.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
    into v_dist from public.courts c where c.id = p_court_id;

  -- 3. inserimento con campi server-side (client_ip, user_agent, risk_score)
  insert into public.check_ins (user_id, court_id, lat, lng, accuracy, client_ip, risk_score)
  values (auth.uid(), p_court_id, p_lat, p_lng, p_accuracy, ...)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function private.check_in(uuid,double precision,double precision,double precision) from public;
grant execute on function private.check_in(uuid,double precision,double precision,double precision) to authenticated;
```

Due accorgimenti dalla doc Supabase: mettere la funzione in uno schema **non esposto** (in schema esposto è chiamabile via Data API con i privilegi del creator) e `set search_path = ''` con nomi qualificati `[6]`.

Per il filtro distanza usare `ST_DWithin`, che sfrutta l'indice GiST; `ST_Distance` non è indexable e serve solo a raffinare i candidati `[20]`. Oggi la query è per `id` quindi va bene, ma se un domani si filtra "campi vicini" `ST_Distance` in `WHERE` sarebbe un table scan.

---

## 5. Karma fairness

### 5.1 Perché l'attuale è ingiusto (oltre ai bug)

- **Asimmetria**: +1 con cap a 100, −3 per no-show. Tre partite per recuperare una defaillance. Un utente nuovo parte a 90: **4 no-show e sei bannato** (`90 - 4*3 = 78`… in realtà servono 14 no-show da 90, ma con il cap a 100 il margine non cresce mai: chi è a 95 ha 15 punti di cuscinetto per sempre, chi è a 100 ha 16). Il sistema non distingue chi ha 3 eventi da chi ne ha 300.
- **Nessun decadimento**: un singolo evento vecchio di un anno pesa come ieri.
- **Nessuna restituzione**: non esiste modo di riguadagnare credibilità oltre al grind +1.
- **Nessun contesto**: il -3 scatta anche se il GPS non prendeva, se l'app crashava, se il campo era allagato. E per il bug `lobby_id`, scatta **sempre**.
- **Cliff**: 49 = bannato, 50 = ok. Nessuna gradualità. Niantic, sullo stesso problema, è passata a una **strike ladder** (warning → degradazione → ban) e riporta che **oltre il 90% di chi ha ricevuto il primo warning ha smesso** `[21]`. Una soglia secca non ha nessuno dei due effetti: non educa, e non perdona.

### 5.2 Ridesign minimo

Sostituire lo scalare con tre campi (o una vista calcolata):

| Campo | Semantica |
|---|---|
| `trust` | lifetime, lento, guadagnato. Serve al ranking / badge, **non** al gate |
| `reliability` | EMA (α ≈ 0.2) su esiti degli ultimi 10 eventi, con `n` esposto: "92 (n=3)" |
| `strikes` | contatore con decadimento (1 strike scade dopo 90 giorni) |

Regole:
1. **Il gate usa `reliability` con `n >= 5`**, altrimenti neutro. Un utente nuovo non può essere escluso.
2. **Penalità proporzionale allo stake**: lobby da 1 persona non è un impegno sociale → peso 0.5; lobby da 6 → peso 1.5.
3. **Grace**: niente penalità se `accuracy > 50 m` al momento del tentativo, se il check-in è fallito per errore di rete documentato, o se il campo ha un `court_report` aperto (`wet_court`) nella finestra.
4. **Un "get out of jail" al mese**: assorbe il primo no-show. Economicamente irrilevante, psicologicamente enorme, e riduce i ticket di supporto.
5. **Ban a 3 strike**, non a soglia. Ogni strike = notifica con motivo + azione richiesta.
6. **Percorso di rientro esplicito**: dopo il ban, 2 check-in verificati sbloccano. Altrimenti il ban è una condanna a vita (§2).
7. **Mostrare il perché**: ogni delta di karma deve avere una riga in un `karma_events` (chi, quando, quanto, perché, `lobby_id`). Oggi il -3 arriva solo come push notification e non è ricostruibile.

### 5.3 Il problema del "+1 per check-in"

Con +1 per check-in e nessuna verifica, il karma è *farmabile* con lo spoofing: 10 check-in falsi su 3 campi in 30 minuti. Se il karma resta un gate d'accesso, ogni punto non verificato è una falla. Due opzioni:
- **A (semplice)**: karma solo da eventi *corroborati* (≥2 utenti distinti al campo nella finestra). Check-in isolato = valido per il no-show, non per il punteggio.
- **B (drastica)**: eliminare il karma come numero pubblico e tenere solo `reliability` privata + badge "affidabile" sopra soglia. Meno gamification, meno incentivo ad attaccarla.

Consiglio A: tiene la gamification, toglie il profitto dallo spoofing.

---

## 6. Reporting e enforcement

### 6.1 Il modello giusto: flag reversibile, non verdetto

Strava è il precedente più vicino (attività GPS, leaderboard, utenti che si accusano):
- il report **rimuove subito** il risultato dalle leaderboard pubbliche, ma l'attività resta e il flag è **annullabile** `[22]`;
- c'è una **tassonomia chiusa** di motivi (`Activity Was in a Vehicle`, `Wrong Activity Type`, `Bad GPS Data`), non testo libero `[22]`;
- il segnalato **riceve notifica** del report `[23]`;
- Strava dichiara esplicitamente che la leaderboard è *community-moderated* `[23]`.

Lezione: costo basso per segnalare, effetto **reversibile e limitato** (si toglie dalla classifica, non si banna), con revisione possibile.

### 6.2 Anti-abuso del report (il punto critico)

Il caso Pogačar dimostra che il flag senza attrito è un'arma: flag ripetuti su un pro, risultati spariti, ripristinati solo dopo intervento `[5]`. Contromisure, tutte già validate altrove:
- **Requisito di prossimità**: puoi segnalare un check-in solo se hai un check-in valido sullo stesso campo entro ±24 h. Strava applica la stessa logica per l'hazard flag: l'opzione compare solo se hai matchato il segmento `[24]`.
- **Peso del reporter** = `reliability` del reporter. Un utente con storico pulito vale più di uno con 3 strike.
- **Rate limit** (§4.3) + **1 report per target per settimana**.
- **Soglia di azione**: 1 report = nessun effetto. 2 report da reporter distinti con peso sufficiente = `unverified` + coda di review. Mai ban automatico da report.
- **Costo del falso report**: -1 di `reliability` al reporter se il report viene respinto **e** il reporter ha già ≥2 report respinti. Non al primo: l'errore onesto è legittimo.

### 6.3 Strike ladder (modellata su Niantic `[21]`)

| Strike | Trigger | Azione | Durata |
|---|---|---|---|
| 0 | 1 segnale euristico | nessuna azione visibile, solo log | — |
| 1 | risk alto o 2 report confermati | warning in-app + check-in marcati `unverified` (nessun karma) | 7 gg |
| 2 | recidiva entro 90 gg | lobby join rate-limited a 1/giorno, badge "sotto revisione" | 14 gg |
| 3 | recidiva | sospensione 30 gg + review umana prima del rientro | 30 gg |
| ban | frode confermata da umano | sospensione lunga, con record della decisione | — |

Ogni gradino deve essere **notificato con motivo** e **appellabile**.

### 6.4 Coda di moderazione

Serve una tabella, non un canale Telegram:

```sql
create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('check_in','user','court_report')),
  target_id uuid not null,
  reason text not null,
  evidence jsonb not null default '{}',   -- risk_score, segnali, reporter_ids
  status text not null default 'open' check (status in ('open','accepted','rejected','escalated')),
  decided_by uuid,          -- NULL = ancora automatico
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz default now()
);
create index on moderation_queue (status, created_at);
```
`evidence` in JSONB permette di aggiungere segnali senza migration. `decided_by NOT NULL` è ciò che distingue una decisione automatica da una umana: serve per §7.

---

## 7. Guardrail legali ed etici (non opzionali in UE)

Un ban generato da un trigger SQL su un punteggio, senza intervento umano, è **decisione basata unicamente su trattamento automatizzato** che incide in modo significativo (esclusione dal servizio): GDPR art. 22. Il paragrafo 3 dà diritto a **intervento umano, esprimere la propria opinione e contestare la decisione** `[25]`.

Traduzione pratica:
1. nessun ban definitivo senza una riga con `decided_by NOT NULL`;
2. UI di contestazione con stato tracciabile;
3. conservare il record della decisione e dei segnali che l'hanno motivata (anche per difendersi da contestazioni);
4. informativa privacy che dica *che* il karma è calcolato automaticamente e *come*.

Corollario GDPR più banale ma spesso dimenticato: `check_ins` è leggibile da tutti (§2). Rendere `SELECT` limitato a "check-in attivi del campo, coordinate arrotondate a ~100 m" è sia privacy che anti-frode: non regali il dataset per addestrare lo spoofer.

---

## 8. Roadmap consigliata

**Fase 0 — bug, prima di qualsiasi anti-fraud (1 giorno)**
- `lobby_id` nel check-in (o join per `user_id` + finestra temporale, così non dipende dal client);
- `remove_expired_bans` deve anche riportare `karma_score` a 50 (o il ban trigger deve guardare `strikes`, non il punteggio);
- `check_ins` SELECT ristretto.

**Fase 1 — igiene (2–3 giorni)**
- insert via RPC `private.check_in`, revoke INSERT diretto;
- rate limit nel trigger con advisory lock;
- tabella `karma_events` (append-only) + `fraud_signals`.

**Fase 2 — detection (1 settimana)**
- velocità implicita + coordinate ripetute + accuracy anomala, calcolati nel trigger, scritti in `fraud_signals`, **senza** bloccare;
- `risk_score` denormalizzato su `check_ins` per query veloci;
- dashboard SQL (o pg_cron + notifica) sui casi `risk >= 5`.

**Fase 3 — fairness (1 settimana)**
- `reliability` EMA + `n`, strike ladder, grace token, decay;
- UI che spiega ogni delta di karma.

**Fase 4 — sociale (2 settimane)**
- corroborazione (check-in verificato con ≥2 utenti vicini);
- report con requisito di prossimità + coda di moderazione + appeal.

**Non fare adesso**: Play Integrity / App Attest, ML su traiettorie, root detection. Nessun payoff finché non c'è una shell nativa e un premio reale in gioco.

---

## 9. Cosa NON funziona (trappole documentate)

- **Fidarsi di `accuracy`** — è auto-dichiarata e la spec non garantisce nulla sulla fonte `[7]`.
- **Bloccare su `isMock`** — aggirabile con Xposed/Magisk, e la fusion di Google a volte non setta il flag `[10][11]`.
- **Bloccare l'utente al primo segnale** — i falsi positivi GPS sono la norma, e il costo reputazionale è asimmetrico.
- **Rate limit client-side** — PostgREST è raggiungibile direttamente con la anon key.
- **Report con effetto immediato e senza costo** — diventa un'arma (caso Pogačar `[5]`).
- **Ban a soglia singola** — non educa e crea cliff; la strike ladder di Niantic ha conversioni migliori `[21]`.
- **Detection "definitiva"** — la letteratura è chiara: anche gli attaccanti adattivi modulano i segnali quando conoscono la difesa `[2]`; lo spoofing è un gioco iterato, non un check.

---

## Fonti

1. Liu, Cheng, Yang, Shu, Weng, Guo, Zeng, Wang, Yang — *Stars Can Tell: A Robust Method to Defend against GPS Spoofing Attacks using Off-the-shelf Chipset*, USENIX Security '21. https://www.usenix.org/conference/usenixsecurity21/presentation/liu-shinan
2. Lo, Chen, Akos, Cotts, Miralles — *Test of Crowdsourced Smartphones Measurements to Detect GNSS Spoofing and Other Disruptions*, ION ITM 2019. https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_Crowdsourced_Spoof_ION_ITM_2019%20.pdf
3. Lee, Kwon, An, Shim — *GPS spoofing detection using accelerometers and performance analysis with probability of detection*, IJCAS 13:951–959, 2015. https://doi.org/10.1007/s12555-014-0347-2
4. Supabase — *Production Checklist: rate limiting, resource allocation & abuse prevention*. https://supabase.com/docs/guides/deployment/going-into-prod
5. Canadian Cycling Magazine — *Tadej Pogačar on his Strava: 'Haters gonna flag'* (2024). https://cyclingmagazine.ca/sections/news/tadej-pogacar-on-his-strava-haters-gonna-flag
6. Supabase — *Row Level Security* (grants vs policies, `security definer`, `search_path`). https://supabase.com/docs/guides/database/postgres/row-level-security
7. W3C — *Geolocation* (definizione di `accuracy` al 95%, fonti non garantite). https://www.w3.org/TR/geolocation/
8. Google Play — *Mock Locations (fake GPS path)* (simulazione di fluttuazioni GPS, route mode). https://play.google.com/store/apps/details?id=ru.gavrikov.mocklocations
9. Android Developers — `Location` API reference (`isMock()`, `isFromMockProvider()` deprecato). https://developer.android.com/reference/android/location/Location
10. Stack Overflow — *Detect or prevent if user uses fake location* (limiti di `isFromMockProvider`, approccio "ultima posizione mock + raggio"). https://stackoverflow.com/questions/42569245/detect-or-prevent-if-user-uses-fake-location
11. auag0/MockLocationDetector — tecniche di detection e bypass via Xposed. https://github.com/auag0/MockLocationDetector
12. Capgo — *capacitor-mock-location-detector* (limiti iOS: nessuna API pubblica per Developer Mode; nessuna disattivazione programmatica). https://github.com/Cap-go/capacitor-mock-location-detector
13. Android Developers — *Integrity verdicts* (`MEETS_DEVICE_INTEGRITY`, `MEETS_STRONG_INTEGRITY`, verifica server-side). https://developer.android.com/google/play/integrity/verdicts
14. Ars Technica — *How hackers broke Pokémon Go's anti-cheat technology in four days* (telemetria, pattern di movimento). https://arstechnica.com/gaming/2016/08/anti-cheat-technology-stopped-pokemon-go-hackers-for-four-days/
15. Douceur-adjacent / survey su Sybil: Stannat, Ileri, Gijswijt, Pouwelse — *Achieving Sybil-Proofness in Distributed Work Systems*, AAMAS 2021. https://www.ifaamas.org/Proceedings/aamas2021/pdfs/p1263.pdf
16. Niantic — *Terms of Service* §3.1 e *Player Guidelines* (multi-account, spoofing, enforcement). https://nianticlabs.com/terms
17. env.dev — *Rate Limiting: Token Bucket, Sliding Window & More* (edge vs app, 429 + Retry-After). https://env.dev/guides/rate-limiting-strategies
18. ASOasis — *Token Bucket Rate Limiting for APIs: Design, Math, and Production Patterns*. https://asoasis.tech/articles/2026-04-24-0252-api-rate-limiting-token-bucket-algorithm
19. RedHuang-0622/hld-handbook — *Rate Limiting Algorithms: Token Bucket vs Sliding Window* (trade-off tabellare, GCRA). https://github.com/RedHuang-0622/hld-handbook/blob/main/content/trade-offs/11-rate-limiting-algorithms.md
20. PostGIS — *ST_DWithin* (uso dell'indice spaziale vs `ST_Distance` non indexable). https://postgis.net/docs/ST_DWithin.html
21. Niantic — *An Update on Our Recent AntiCheat Efforts* (>90% smette dopo il primo warning; strike ladder). https://nianticlabs.com/news/cheatingupdate-022321
22. Strava — *The Activity Flag: Remove an Activity's Segment Results from the Leaderboard*. https://support.strava.com/hc/en-us/articles/216919387
23. Strava — *How Do I Report Cheating on Strava?* (community-moderated, notifica al segnalato). https://support.strava.com/en-us/articles/15402146-how-do-i-report-cheating-on-strava
24. Strava — *Flagging a Segment as Hazardous* (requisito: aver matchato il segmento per poter flaggare). https://strava.zendesk.com/hc/en-us/articles/216918217-Flagging-a-Segment-as-Hazardous
25. GDPR — Art. 22, *Automated individual decision-making, including profiling*. https://gdpr-info.eu/art-22-gdpr/

### Riferimenti interni al repo
- `supabase/migrations/001_initial_schema.sql` — schema, trigger karma/ban/cooldown/distanza
- `supabase/migrations/002_push_notification_triggers.sql` — `decrement_karma_on_missed_check_in` ridefinita
- `components/check-in/check-in-sheet.tsx` — insert client-side, `MAX_ACCURACY = 20`
- `components/lobby/lobby-card.tsx` — join lobby
