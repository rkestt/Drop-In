---
id: d25
type: task
hitl: false
claimed: false
blocked_by: [d17, d18, d19, d20, d21, d22, d23, d24]
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

(TBD — chiudere con: violazioni trovate/corrette, route coperte, percorso tastiera, esito CI e live, data.)
