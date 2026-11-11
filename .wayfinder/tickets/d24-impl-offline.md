---
id: d24
type: impl
hitl: false
claimed: true
blocked_by: [d16, d5, d6]
status: closed
closed_at: 2026-11-10
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

Implementato il 2026-11-10 su `fix/d24-f3` (prototipo d16 approvato da Andrea, copy/gerarchia vincolanti).

**Chiavi cache** (`lib/offline/cache.ts`, TTL 24h, solo dati pubblici): `dropin:cache:courts:v1`, `dropin:cache:lobbies:v1`, `dropin:cache:court:v1:<id>`. Gotcha trovato in verifica: supabase-js non lancia su errore rete, ritorna `{ error }` — ogni fetch ora lo controlla o il fallback non scatta mai.

**Route verificate offline** (build prod porta 3116, Supabase davvero spento, zero `pageerror`):
- `/` con cache: lista+pin visibili, banner "Sei offline · dati di N min fa" + Riprova, stale badge "Dati di N min fa". Riconnessione: banner verde 3s + refresh.
- `/courts/<id>` con cache: shell leggibile (nome, stale, azioni bloccate con spiegazione "Serve la connessione per il check-in", nessuna scrittura). Senza cache: "Non riusciamo a caricare questa pagina." + Riprova + Torna alla mappa (mai 404 secco). Chiude il residuo di `d1`.
- `/courts/<id-inesistente>` a Supabase su: 404 vera (PGRST116 → `notFound()`).
- `/lobbies`, `/profile` con Supabase down: fail open via middleware/redirect al login sulla home, nessuna schermata bianca.
- Origin morta (server spento): SW serve `/~offline` precached (fallback `document` in `app/sw.ts`; tile `map-tiles-*` e font invariati).

**Esito SW**: precache `/~offline` ok (revision "1" già in next.config.js), fallback navigazione verificato con origin morta (200 dal SW).

**Spec**: `docs/design/specs/offline.md` (stati, copy, cache, SW, a11y, screenshot in `/tmp/opencode/d24-*.png`, nota deploy: `/supabase` relativo solo in dev).

**Comandi**: `npm run lint` 0 errori · `tsc` verde · `lint:design` OK (76 file) · `vitest` 117+8 pass · `test:a11y` 3 pass · e2e `d24-offline.spec.ts` 1 pass · `npm run build` verde.

**Scostamenti dal ticket**: `components/offline/cache-writer.tsx` aggiunto (la pagina campo è server e non tocca localStorage); `CourtOfflineShell` legge la cache post-mount per non rompere l'hydration; `/lobbies` e `/profile` non hanno shell dedicata — il fail-open esistente (redirect login) basta per "nessuna schermata bianca"; nessuna coda di mutazioni (fuori scope da ticket).

**Follow-up @oracle (APPROVE WITH NITS, chiuso il 2026-11-10):**
1. Banner anche quando il backend è ko ma il browser è online: nuova prop `forceStale` (passata da `stale` in home) — titolo "Dati di N min fa" + "Il server non risponde: vedi i dati salvati sul telefono." + Riprova; mai "Sei offline" se non è vero. Verificato con Supabase spento: banner visibile, resta dopo Riprova.
2. `CourtOfflineShell`: durante `!ready` skeleton neutro (stesso output del server), errore "Non riusciamo…" solo a `ready && !cached` — niente flash d'errore a chi ha la cache.
3. Vuoto-mappa: titolo di nuovo dinamico (`Nessun campo da ${sportLabel(sport).toLowerCase()} in quest'area`, o "Nessun campo in quest'area" se sport null); corpo + CTA "Aggiungi il primo campo" dal prototipo.
4. Minori: `readCache` rimuove le entry scadute (test dedicato); `onRetry` via ref nelle deps del banner; guard `if (trying) return` in `OfflineRetry`. Spec e2e resa deterministica (`expect.poll` sul popolamento cache).
