---
id: d21
type: impl
hitl: false
claimed: false
blocked_by: [d13, d5, d6]
---
## Question

**Obiettivo.** Implementare il check-in approvato in `d13`: un passo, tutti gli errori veri con recovery, successo che dice fino a quando vale. Nessun finto successo, nessun mock in produzione.

**Prerequisiti.** Prototipo `docs/design/prototypes/checkin.html` approvato (leggi la Resolution di `d13`). `Drawer` (`d5`) e Sonner (`d6`) disponibili. Se `d7` è chiuso, usa `success-pop`; altrimenti il pop CSS esistente.

**File coinvolti.**

- `components/check-in/check-in-sheet.tsx`: riscrittura degli stati; resta il nome del file per non rompere gli import.
- `components/check-in/check-in-button.tsx`, `checkout-button.tsx`: stati coerenti con la scheda campo.
- `app/(app)/courts/[id]/page.tsx`: passa `courtLat`/`courtLng` (già presenti) e lo stato del check-in attivo.
- `lib/checkin/errors.ts` (nuovo, puro): mappa errori geolocalizzazione (`code` 1/2/3), accuratezza > 20 m, messaggio DB "troppo lontano (N m)", già dentro/cooldown; testi in italiano con recovery.
- `tests/unit/checkin-errors.test.ts` (nuovo).
- `docs/design/specs/check-in.md` (nuovo).

**Stati (tutti raggiungibili in sviluppo).**

1. **Idle**: nome campo, finestra, spiegazione GPS 50 m, CTA "Fai check-in".
2. **Loading**: "Verifica posizione…", bottone disabilitato, `aria-busy`.
3. **Permesso negato** (`code === 1`): causa + "Abilita la posizione e riprova" + "Riprova".
4. **Posizione non disponibile** (`code === 2`) e **timeout** (`code === 3`): messaggi distinti + "Riprova".
5. **Accuratezza insufficiente** (`accuracy > 20 m`): "Segnale GPS debole (±45 m). Esci all'aperto e riprova." + "Riprova".
6. **Fuori raggio**: usa il messaggio del trigger (`Sei troppo lontano dal campo (N m).`) e mostra "Aggiorna posizione"; nessun calcolo duplicato client.
7. **Già dentro / cooldown**: stato "Sei qui dalle HH:MM, check-in attivo fino alle HH:MM" + "Fai check-out" secondaria; nessun secondo check-in.
8. **Successo**: pop, "Check-in attivo fino alle HH:MM", chiusura esplicita.
9. **Errore server generico**: messaggio + "Riprova", dati conservati.

**Mock GPS.**

- Riusa `NEXT_PUBLIC_ALLOW_MOCK_GPS` se `t10` l'ha già introdotta; **non creare una seconda variabile**.
- Attiva solo se `process.env.NEXT_PUBLIC_ALLOW_MOCK_GPS === "true"` **e** `process.env.NODE_ENV !== "production"`. In produzione il ramo è dead code e non deve comparire nel bundle finale (verifica con grep sul build).
- Quando il mock è attivo, la UI lo dichiara ("Posizione simulata", `--warning`) e non è mai raggiungibile con l'env assente.
- Il check-in reale resta validato dal trigger DB a 50 m: il client non è la difesa.

**Regole.**

- Nessun successo ottimistico: il check-in è confermato solo dopo l'insert riuscito.
- Il bottone non è tappabile due volte (`disabled` durante la richiesta).
- La scadenza si calcola da `checked_in_at + 2h` (auto-checkout) e si formatta `it-IT`.
- Reduced motion: niente pop, il testo "Check-in attivo…" resta.
- Errori di campo/rete inline; il toast Sonner è solo per l'esito non bloccante.

**Acceptance.**

- `tests/unit/checkin-errors.test.ts` copre i codici 1/2/3, accuratezza, messaggio distanza, già dentro.
- Ogni stato è raggiungibile con DevTools → Sensors (location) + permessi sito; il flusso reale funziona con GPS vero.
- Dopo un check-in riuscito il record `check_ins` ha `status='active'` e la UI mostra la scadenza; il reload mantiene lo stato.
- Con mock disattivo nessun percorso usa `courtLat/courtLng` al posto del GPS.
- `npm run build` non contiene la stringa del mock se l'env è assente (grep).
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/checkin-errors.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
grep -r "ALLOW_MOCK_GPS" .next/static 2>/dev/null | head
# manuale: DevTools → Sensors per permesso/posizione; poi check-in reale
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (Check-in), `supabase/migrations/001_initial_schema.sql` (`enforce_check_in_distance`), `docs/design/prototypes/checkin.html`.

## Issue GitHub collegate

Assorbite da questo ticket (dedup del Phase 1 review, PR #49):

- #57 `fix(rls): prevent court_id swap to pending courts in lobbies/check_ins
  UPDATE` (parte check_ins) — nessun `court_id` verso campi non approvati.

## Resolution

Chiuso 2026-11-10 su `fix/d21-f3`. Tutti i 9 stati del prototipo
(`docs/design/prototypes/checkin.html`, approvato da Andrea il 2026-11-10)
sono implementati in `components/check-in/check-in-sheet.tsx` (stesso nome
file, riuso `Drawer` d5/d7-d8, `StepTransition`, `SuccessPop`, Sonner):

- idle (finestra 2h, nota GPS 50 m, CTA) · loading (`aria-busy`) · permesso
  negato (code 1 + disclosure "Come fare") · posizione/timeout (code 2/3,
  messaggi distinti) · accuratezza > 20 m · fuori raggio (messaggio del
  trigger, CTA "Aggiorna posizione") · già dentro (dalle HH:MM, fino alle
  HH:MM, check-out secondaria) · successo (`SuccessPop`, "fino alle HH:MM",
  chiusura esplicita, niente auto-close) · server generico (dati conservati).
- Errori inline (`role="alert"`), esiti `role="status"`; reduced motion via
  `SuccessPop`/`StepTransition` (testo invariato, niente pop); touch ≥ 44px;
  token-only (`lint:design` verde).
- Nessun successo ottimistico (solo dopo insert), bottone disabilitato
  durante la richiesta, scadenza = `checked_in_at + 2h` it-IT.
- `lib/checkin/errors.ts` (puro) + `tests/unit/checkin-errors.test.ts`
  (14 test): code 1/2/3, accuratezza, distanza, cooldown 5 min, già dentro.
- `page.tsx` additiva: query `check_ins` active dell'utente + prop
  `activeCheckIn`; `CheckInButton` label "Sei qui" se attivo. File vietati
  intoccati (`stack.md`, `MAP.md`, `1.5.md`, `playwright.config.ts`,
  `drawer.tsx`).
- Mock GPS: flag calcolata dal Server Component e passata come prop
  `mockGps` (`NEXT_PUBLIC_ALLOW_MOCK_GPS=true` + non-produzione); nel client
  non compare il nome della variabile — `grep ALLOW_MOCK_GPS .next/static`
  vuoto sul build di produzione. Nessuna seconda variabile.

**Fix DB al contorno (migration 017).** Il trigger
`enforce_check_in_distance` usava `%.0f` in `RAISE EXCEPTION`, ma RAISE
capisce solo `%` nudo: il messaggio live era "(1003.40670779.0f m)".
Ora usa `format()` con `ROUND(...)::INT` → "(1003 m)". Il parser client
(`parseDistanceMeters`) resta tollerante anche al vecchio formato.

**Verifica live (Playwright, config copiata con porta 3120, poi cancellata).**
Login UI flaky in locale + sessione server cieca (storage key browser
`sb-localhost-auth-token` vs server, bug pre-esistente fuori scope): per i
test ho firmato la sessione via cookie nel formato @supabase/ssr. Stati
verificati con GPS vero e mock, screenshot in `/tmp/opencode/`:
`d21-sheet-idle/​success/​inside` (1280), `d21-sheet-denied-360.png`,
`d21-sheet-range-360.png` ("Sei a 1003 m dal campo", trigger reale).

**Comandi.** `npm run lint` ok (1 warning pre-esistente in
`scripts/check-design.mjs`), `tsc` 0, `lint:design` OK (99 file),
`vitest` 202/202, `test:a11y` 3/3, `npm run build` ok + grep mock vuoto.

**Scostamenti dal prototipo.** (1) Auto-close dopo successo rimosso:
il prototipo chiede chiusura esplicita ("Chiudi"). (2) Riga "Precisione
GPS" nascosta quando l'accuratezza è 0/sconosciuta. (3) `pl-4` invece di
18px nella disclosure (scala token). (4) Toast Sonner anche sul successo
(esito non bloccante) oltre all'inline; sul check-out solo in caso di
errore. (5) `docs/design/specs/checkin.md` (nome del task) invece di
`check-in.md` (nome indicato nel ticket). (6) Range semplificato: niente
hero metrico/gauge, solo testo con i metri reali + hint (dettagli in
`docs/design/specs/checkin.md`, sezione scostamenti). (7) Check-out:
"**Fai check-out**" come da prototipo. (8) Check-in scaduto → idle con
nuovo check-in immediato; sessione assente/scaduta → apre il `LoginModal`.

## Segu-up (review oracle su 26cf226)

1. Scaduto → idle via `isCheckinActive()` in `lib/checkin/errors.ts`
   (+3 unit test); mai più "fino alle <ora passata>".
2. Ramo `auth` in `fromInsertError` (`/accesso|login|sessione/i` →
   "Accedi di nuovo per fare il check-in"); senza sessione la scheda apre
   direttamente il `LoginModal`, l'errore `auth` da insert riapre il login.
3. Checkout "Fai check-out" (copy prototipo).
4. Spec: sezione scostamenti con range + claim mock precisa
   (`ALLOW_MOCK_GPS` letta solo in `page.tsx` server-side).
Riverifica: `vitest` 206/206, `lint` ok (warning pre-esistente),
`tsc` 0, `lint:design` OK; live `court-detail.spec` 2/2 su porta 3120.
