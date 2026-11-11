---
id: d25
type: task
hitl: false
claimed: true
blocked_by: [d17, d18, d19, d20, d21, d22, d23, d24]
status: closed
closed_at: 2026-11-11
---
## Question

**Obiettivo.** Chiudere l'accessibilità su tutte le schermate: axe a zero, tastiera completa, focus order, contrasto, target, reduced motion. Non è un audit teorico: si correggono le violazioni trovate.

**Prerequisiti.** Tutte le implementazioni `d17`–`d24` chiuse. `test:a11y` oggi copre solo `/styleguide`, `/~offline`, `/submit-court` e non gira sulle route autenticate.

**File coinvolti.**

- `tests/e2e/a11y.spec.ts`: route statiche (CI) + route autenticate (locale/DB).
- `tests/e2e/helpers/auth.ts` (nuovo): crea un utente con `createTestUser`, fa login via UI e salva `storageState` per i test successivi.
- Correzioni sparse in `app/**` e `components/**` (focus, label, `aria-*`, contrasto, heading order, landmark).
- `docs/design/accessibility.md`: tabella route × esito, percorso tastiera, eccezioni.
- `docs/design/gaps.md`: chiudere le righe risolte, aggiungere quelle accettate.

**Route da coprire.**

Statiche (devono restare verdi in CI, senza Supabase): `/`, `/styleguide`, `/~offline`, `/submit-court`.
Con DB/auth (locali, con Supabase up): `/courts/<seed>`, `/lobbies`, `/lobbies/<id>`, `/profile`, `/settings`, `/notifications`.

- `/` ha la mappa: axe sulla pagina è ok, ma escludere dal test il canvas MapLibre (attributi del provider, non nostri) e verificare a mano i controlli zoom.
- Le route con DB non vanno in CI finché la CI non ha Supabase: usare `test.skip(!process.env.E2E_WITH_DB)` o un progetto Playwright dedicato, documentato.

**Cosa controllare e correggere.**

- **Focus**: ordine logico, focus visibile su ogni interattivo, nessun `tabindex` positivo, restore focus dopo drawer/dialog.
- **Nomi accessibili**: icone decorative `aria-hidden`, bottoni icona con `aria-label`, link con testo comprensibile, campi con label associata.
- **Stato**: `aria-current="page"` nella nav, `aria-selected` nei tab, `aria-pressed`/`aria-checked` negli switch, `aria-live` su esiti e cambi online/offline.
- **Struttura**: un solo `h1` per pagina, heading in ordine, landmark (`main`, `nav`, `header`), skip link "Vai al contenuto" se manca.
- **Contrasto**: axe `color-contrast` inclusi i nuovi testi; nessun testo su accent/danger con foreground sbagliato.
- **Target**: 44px su tutti i controlli, inclusi chip, icone, handle, link nelle liste.
- **Motion**: con reduced motion nessuna informazione sparisce; nessun contenuto lampeggiante.
- **Form**: errori con `aria-invalid` + `aria-describedby`, focus sul primo errore, messaggi non solo colore.
- **Mappa**: marker con `role="button"`, `tabindex="0"`, nome accessibile; controlli zoom 44px; attribuzione leggibile.

**Acceptance.**

- `npm run test:a11y` verde: 0 violazioni sulle route statiche in CI.
- Con Supabase up, la suite estesa è verde su tutte le route elencate (0 violazioni).
- Percorso tastiera documentato per: mappa → ricerca → campo → check-in; lista lobby → dettaglio → join; profilo → modifica; impostazioni → logout. Ogni passaggio ha focus visibile e nessuna trappola.
- Nessun `tabindex` positivo nel codice (`grep`), nessun `outline: none` senza anello sostitutivo.
- Skip link presente e funzionante su tutte le pagine con nav.
- `docs/design/accessibility.md` aggiornato con esiti e data; `gaps.md` coerente.
- `@tester` firma la verifica live con screenshot e note.

**Comandi di verifica.**

```bash
npm run test:a11y
# con Supabase up:
E2E_WITH_DB=1 npx playwright test tests/e2e/a11y.spec.ts
grep -rn "tabindex=\"[1-9]" app components
grep -rn "outline-none" app components | head
```

**Riferimenti.** `docs/design/accessibility.md`, `docs/design/checklist.md` (Contrasto e accessibilità), `docs/design/1.5.md` (F4).

## Resolution

Chiude d25 (2026-11-10). Suite `tests/e2e/a11y.spec.ts` estesa da 3 a 15 test, tutti verdi (`E2E_WITH_DB=1 npx playwright test tests/e2e/a11y.spec.ts` su config con porta 3121: 15 passed; senza flag gli 8 statici passano e i 7 con DB sono skippati, quindi la CI resta verde senza Supabase).

Violazioni trovate e corrette (nessun cambio di copy/token visivi d'identità):

- `color-contrast` 4,09:1 (axe `serious`): testo `text-[var(--danger)]` su `bg-danger/10` nello stato di errore del login. Corretto passando a `--danger-dark` (7,35:1, la variante "su tinta" già usata dai badge), stessa tinta di sfondo. Stessa combinazione sistemata in `submit-court-form` (2 punti), `create-lobby-drawer`, `edit-profile-sheet`, `account-section`, `karma-indicator` (low), `ban-banner` (testo + icona). Documentato in `accessibility.md` (tabella + regola).
- `target-size` sui marker mappa: erano 40px (`w-10`), portati a 44px (`w-11`) come da minimo di progetto.

Eccezioni documentate (non corrette nel codice):

- Marker `.court-marker` esclusi dall'axe (`.exclude`) su `/` e pagine con mappa: i seed condividono le coordinate, i marker si sovrappongono e `target-size` fallisce per geometria dei dati. Ruolo/tabindex/nome/focus coperti da asserzioni esplicite nel test; rimozione = clustering/spiderfy (riga in `gaps.md`).

Aggiunte tastiera/struttura: componente `SkipLink` nei layout `(app)`/`(dashboard)` + `main#contenuto tabIndex={-1}` su tutte le pagine dei due gruppi; helper `tests/e2e/helpers/auth.ts` (utente confermato via Admin API + login via UI + storageState); test skip-link (`/` e `/settings`), login interamente da tastiera con esito `role="alert"`, marker operabili, reduced-motion. `grep tabindex="[1-9]`: pulito. `outline-none` solo con anello `focus-visible` o su contenitori non interattivi (popup Base UI, heading con focus programmatico).

Route coperte: `/`, `/styleguide`, `/~offline`, `/submit-court`, `/?login=required`, `/profile`, `/settings`, `/notifications`, `/lobbies`, `/lobbies/<seed>`, `/courts/<seed>`.

Verifica: `npm run lint` (0 errori, 1 warning pre-esistente in `scripts/check-design.mjs`), `tsc --noEmit` verde, `lint:design` OK (105 file), `vitest` 220 passed. Da fare fuori da questo ticket: firma live @tester con screenshot.

## Resolution — review @oracle (2026-11-11, REJECT rientrato)

Bloccanti:

1. CI rossa (test home fuori dal gate ma dipendenti dai seed): risolto. Il test axe su `/` non attende più i marker (passa a mappa vuota) e i test marker/skip-`/`/login sono dentro il describe gateato `E2E_WITH_DB`. Verifica DB-less con REST+auth abortiti (contesto fresco): 0 marker, `#contenuto` e regione mappa presenti, 0 violazioni, skip link primo al Tab. Esiti: senza flag 5 passed / 10 skipped; con `E2E_WITH_DB=1` 15 passed (vedi sotto).
2. Residuo contrasto `courts/[id]` header "Segnalazioni attive" (`text-danger` su `bg-danger/5`): passato a `--danger-dark`. Verificato con riga temporanea in `court_reports` (scadenza +1 giorno): header visibile, 0 violazioni `color-contrast`; riga rimossa dopo la prova.

Nit:

3. `lobbies/[id]/not-found.tsx`: `main` ora con `id="contenuto" tabIndex={-1}`.
4. Marker: il test preme Invio e attende navigazione a `/courts/<uuid>` (effetto reale via `window.location.href`).
5. `helpers/auth.ts`: `resolveServiceRoleKey()` lancia se la env manca e l'URL non è localhost/127.0.0.1.

Esiti finali (config /tmp porta 3121): senza flag 5 passed / 10 skipped; con `E2E_WITH_DB=1` 15 passed. `tsc`, `lint` (0 errori), `lint:design`, `vitest` (220) verdi.

## Resolution — finding @tester sul drawer nickname (2026-11-11)

Difetto reale: all'apertura del drawer "Modifica nickname" il focus restava su `body`, il primo Tab usciva sullo skip link e il trap non ingaggiava. Causa: `initialFocus={nicknameRef}` — Base UI legge `ref.current` troppo presto (popup appena montato, ref del campo ancora `null`).

Correzione: `initialFocus` passato come **funzione** `() => nicknameRef.current` (forma accettata dall'API Base UI, valutata all'apertura a ref attaccato). Tipo allargato in `components/ui/drawer.tsx`. Alternativa scartata: `useEffect` post-open (duplica il meccanismo Base UI); default senza `initialFocus` (mette il focus sul container del popup, non sul campo — verificato sul login).

Verifica: nuovo `tests/e2e/drawer-nickname.spec.ts` (gateato `E2E_WITH_DB`, pattern di `a11y.spec.ts`): apertura → `activeElement` è `#profile-nickname` senza Tab; 5 Tab + 2 Shift+Tab restano nel dialog; axe pulito sul drawer aperto; Esc chiude e il focus torna sul trigger. Verde (3 run).

Altri drawer: `first-run.tsx` usa lo stesso pattern ma ha un `useEffect [open, step]` di backup che mette il focus sul titolo — funziona, non toccato. `login-modal`, `check-in-sheet`, `create-lobby-drawer`, `report-drawer`, `join-lobby-drawer`, `coach-mark` non passano `initialFocus` (default Base UI): focus sul container, trap ok — nessun intervento.
