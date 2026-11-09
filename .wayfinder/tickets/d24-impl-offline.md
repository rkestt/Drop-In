---
id: d24
type: impl
hitl: false
claimed: false
blocked_by: [d16, d5, d6]
---
## Question

**Obiettivo.** Implementare gli stati offline/errore/vuoto approvati in `d16`: dati in cache con indicazione dell'età, azioni disabilitate con spiegazione, nessuna schermata bianca, nessun finto successo.

**Prerequisiti.** Prototipo `docs/design/prototypes/offline.html` approvato (leggi la Resolution di `d16`).

**File coinvolti.**

- `lib/offline/cache.ts` (nuovo, puro): `readCache<T>(key)`, `writeCache(key, value)`, `cacheAge(key)`; chiavi `dropin:cache:courts:v1`, `dropin:cache:lobbies:v1`; TTL 24h; gestione `localStorage` assente/quota piena.
- `tests/unit/offline-cache.test.ts` (nuovo).
- `components/offline/connection-banner.tsx` (nuovo): offline / tornato online, `role="status"`, dismiss.
- `components/offline/stale-badge.tsx` (nuovo): "Dati di 12 min fa", `--warning`, non invadente.
- `app/(app)/page.tsx`: salva l'ultima risposta buona di campi e lobby; se offline o la fetch fallisce, legge la cache e mostra lo stale badge; "Riprova" rifà la fetch.
- `app/~offline/page.tsx`: pagina statica con cosa funziona e cosa no.
- `app/error.tsx`, `app/global-error.tsx`: gerarchia e copy del prototipo; il global error resta senza dipendenze (stili inline) e leggibile.
- `app/sw.ts`: fallback di navigazione verso `/~offline` per le route non in cache; `/~offline` già precachata (verifica `additionalPrecacheEntries` in `next.config.js`).
- `docs/design/specs/offline.md` (nuovo).

**Comportamento.**

- **Offline con cache**: mappa e lista restano visibili; banner "Sei offline · dati di N min fa"; nessuna scrittura.
- **Azione che richiede rete** (check-in, join, segnalazione): CTA disabilitata con spiegazione ("Serve la connessione"); nessun optimistic che poi fallisce in silenzio.
- **Riconnessione**: banner `--success` "Di nuovo online" + refresh automatico della fetch corrente; il banner sparisce dopo 3s.
- **Vuoti**: mappa ("Nessun campo qui. Aggiungi il primo."), ricerca ("Nessun campo per «x»" + "Cancella ricerca"), lobby ("Nessuna lobby. Sii il primo."), notifiche (link a `d22`).
- **Errore route**: "Non riusciamo a caricare questa pagina" + "Riprova" + "Torna alla mappa".
- **Errore critico**: stessa gerarchia, stile minimo, nessun font/token esterno indispensabile.
- **Offline totale**: `/~offline` dice cosa resta (mappa in cache, campi visitati) e cosa no; CTA "Riprova".

**Regole.**

- Mai un empty state durante il caricamento: prima skeleton, poi vuoto.
- Offline non è errore: `--warning` e tono informativo; `--danger` solo per errori veri.
- La cache è solo dati pubblici (campi, lobby); **mai** profilo, karma, notifiche o coordinate utente.
- Nessuna coda di mutazioni offline (fuori scope): le azioni che scrivono restano bloccate con spiegazione.
- Il service worker è attivo solo in build di produzione: la verifica offline si fa con `npm run build && npm start`, non in `next dev`.

**Acceptance.**

- `tests/unit/offline-cache.test.ts` copre: scrittura/lettura, TTL scaduto, quota piena, localStorage assente, dati non-JSON.
- Build di produzione: DevTools offline → `/`, `/courts/<id>`, `/profile`, `/lobbies` non mostrano schermata bianca; almeno `/~offline` o la cache risponde.
- Con cache popolata, `/` mostra i campi e "dati di N min fa"; "Riprova" aggiorna.
- Check-in/join offline: CTA disabilitata + spiegazione; nessuna riga creata nel DB.
- Riconnessione: banner verde e fetch aggiornata.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run lint:design` verdi; `@tester` verifica live con screenshot.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/offline-cache.test.ts
npm run build && npm start
# DevTools → Network → Offline: /, /courts/<id>, /profile, /lobbies, /~offline
npm run lint && npx tsc --noEmit && npm run lint:design
```

**Riferimenti.** `docs/research/pwa-offline.md`, `docs/design/patterns/states.md`, `app/sw.ts`, `docs/design/prototypes/offline.html`.

## Resolution

(TBD — chiudere con: chiavi cache, route verificate offline, esito SW, screenshot, spec.)
