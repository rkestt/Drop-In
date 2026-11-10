# Spec — Offline, errore, stati vuoti (d24)

Prototipo approvato da Andrea il 2026-11-10: `docs/design/prototypes/offline.html`
(13 stati nella toolbar). Copy, gerarchia e "errore critico" (colori/font di
sistema) sono vincolanti e vengono dal prototipo.

## 1. Obiettivo

Con rete assente o Supabase irraggiungibile, l'utente vede sempre una shell
leggibile (dati in cache con età, oppure messaggio + un solo next step).
Mai schermata bianca, mai finto successo, mai 404 secco per un campo visitato.

## 2. Stati

### Offline con cache (`/`, stati 02/04/05 del prototipo)

- Banner `ConnectionBanner`: "Sei offline · dati di N min fa" + "I campi qui
  sotto sono salvati sul telefono." + **Riprova** (un solo next step) +
  Chiudi (dismiss). `--warning`, tono informativo: l'offline non è un errore.
- `StaleBadge` accanto a "Partite vicine": "Dati di N min fa".
- Mappa e lista restano visibili dai dati in cache; nessuna scrittura.
- Retry in corso: bottone "Riprova…" con `aria-busy`; se fallisce resta la
  cache (nessuno stato d'errore separato oltre al banner).

### Azione che richiede rete (stato 03)

- Check-in / crea lobby / segnalazione: CTA con `aria-disabled` + spiegazione
  "Serve la connessione per il check-in. Il check-in dice chi c'è sul campo
  adesso: senza rete non possiamo registrarlo." + "I pulsanti si attivano
  appena torni online. Non registriamo azioni che non possiamo confermare."
- Nessuna coda di mutazioni offline (fuori scope per decisione).

### Riconnessione (stato 06)

- Banner `--success` "Di nuovo online / Aggiorniamo campi e lobby." che chiama
  `onRetry` (refresh della fetch corrente) e sparisce dopo 3s.

### Errore di route (stato 07, `app/error.tsx`)

- "!" + "Non riusciamo a caricare questa pagina." + "La connessione è caduta
  mentre caricavamo i campi. Quelli che hai già aperto restano sul telefono."
  + **Riprova** + **Torna alla mappa**. `role="alert"`.

### Errore critico (stato 08, `app/global-error.tsx`)

- Stessa gerarchia, copy: brand "Drop-In", "Qualcosa si è rotto.",
  "Drop-In non è riuscito ad avviarsi. Ricarica la pagina; se succede ancora,
  riapri l'app tra qualche minuto.", **Riprova** + **Torna alla mappa**.
- Solo colori (`Canvas`, `CanvasText`, `GrayText`, `ButtonText`, `LinkText`) e
  font di sistema, stili inline, **zero import dall'app** (né logger, né
  `next/link`: niente router context qui). Deve leggersi anche se CSS e font
  dell'app non sono disponibili.

### Offline totale (`/~offline`, stato 13)

- Pagina **statica** (precached dal SW, niente cookies/headers/searchParams/auth).
- "Sei offline." + "Drop-In non raggiunge la rete. Quello che hai già aperto
  resta sul telefono; il resto aspetta."
- Card "Resta disponibile": la mappa che hai già visto; i campi che hai aperto
  (+ nota se non hai aperto nulla). Card "Non disponibile": check-in, lobby,
  segnalazioni. Un solo next step: **Riprova** + "Ultimo aggiornamento: …".

### Vuoti (stati 09–12)

- Mai un empty state durante il caricamento: prima skeleton, poi vuoto.
- Mappa: "Nessun campo da basket in quest'area" + "Sposta la mappa o allarga
  la zona: i campi compaiono quando entrano nel raggio." +
  **Aggiungi il primo campo**.
- Ricerca: "Nessun campo per «x»" + **Cancella ricerca** (un solo next step).
- Lobby (dettaglio campo): "Nessuna lobby qui intorno. Sii il primo." +
  "Una lobby è un appuntamento: scegli orario e quanti siete, gli altri si
  uniscono dalla mappa." + **Crea una lobby**.
- Notifiche: resta il copy esistente (link a d22 per la scheda completa).

## 3. Cache locale (`lib/offline/cache.ts`)

- Chiavi: `dropin:cache:courts:v1`, `dropin:cache:lobbies:v1`,
  `dropin:cache:court:v1:<id>`. TTL 24h. Solo dati pubblici: **mai** profilo,
  karma, notifiche o coordinate utente.
- `writeCache` ritorna `false` (mai lanciare) se storage assente, quota piena
  o valore non serializzabile. `readCache` ritorna `null` oltre il TTL, con
  dati non-JSON o forma diversa (e rimuove la chiave corrotta).
- Nota gotcha: **supabase-js non lancia su errore rete**, ritorna `{ error }`.
  Ogni fetch deve controllare `error` esplicitamente o il fallback cache non
  scatta mai.

## 4. Service worker (`app/sw.ts`)

- `fallbacks.entries: [{ url: "/~offline", matcher: document }]` — navigazione
  con origin morta → shell precached. Regole tile (`map-tiles-*`) e font
  invariate. `additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }]`
  già in `next.config.js`.
- Nota deploy: `NEXT_PUBLIC_SUPABASE_URL=/supabase` funziona solo in dev
  (rewrite); in produzione serve l'URL assoluto o ogni fetch fallisce.

## 5. A11y

- Banner: `role="status"` + `aria-atomic`; errore route e critico:
  `role="alert"`. Stale badge: testo semplice (annunciato dal banner).
- CTA bloccate: `aria-disabled` + `aria-describedby` con la spiegazione
  (mai `disabled` secco senza motivo). Target ≥ 44px, focus visibile dai token.
- Skeleton con `role="status"` + testo sr-only, mai un vuoto durante il load.
- Contrasto: `--warning-dark`/`--success-dark` su sfondi `/10`, come Badge.

## 6. Screenshot (verifica @tester, Supabase spento, build prod, porta 3116)

- `/` offline con cache + banner: `d24-offline-360.png`
- `/courts/<id>` shell con cache: `d24-court-360.png`
- `/courts/<id-ignoto>` messaggio + Riprova: `d24-unknown-360.png`
- `/~offline`: `d24-total-360.png`, `d24-total-768.png`
- fallback SW a origin morta: `d24-sw-fallback-360.png`

## 7. Verifica manuale (non automatizzabile in e2e: `setOffline` stacca anche localhost)

```bash
npm run build && npm start -- -p 3116   # SW attivo solo in prod
# visita / e un campo (popola localStorage + precache SW), poi:
npx supabase stop
# / → cache + stale · /courts/<id> → shell · /courts/sconosciuto → messaggio
# /lobbies → redirect login sulla home (fail open, no blank) · /~offline → statica
```

Test automatici: `tests/unit/offline-cache.test.ts` (8 casi),
`tests/e2e/d24-offline.spec.ts` (Supabase abortita a livello browser: `/`
mostra cache + stale badge).
