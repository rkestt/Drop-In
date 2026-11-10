---
id: d18
type: impl
hitl: false
claimed: false
blocked_by: [d10, d5, d6]
---
## Question

**Obiettivo.** Implementare Impostazioni con sole azioni reali: avvisi nell'app, posizione, account, informazioni. Niente switch push finto, niente "elimina account" che non funziona.

**Prerequisiti.** Prototipo `docs/design/prototypes/settings.html` approvato (leggi la Resolution di `d10`). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `app/(dashboard)/settings/page.tsx` (nuovo, server): auth guard, profilo, render delle sezioni.
- `components/settings/notifications-section.tsx` (nuovo, client): link a `/notifications`, switch "Pallino degli avvisi non letti" (localStorage), riga "Notifiche push" disabilitata con spiegazione.
- `components/settings/location-section.tsx` (nuovo, client): stato permesso via `navigator.permissions.query({ name: "geolocation" })` + fallback `navigator.geolocation`, azione "Riprova".
- `components/settings/account-section.tsx` (nuovo, client): email, link modifica nickname, logout con drawer di conferma.
- `components/settings/info-section.tsx` (nuovo): versione, licenze OSM/OpenFreeMap, link privacy.
- `lib/settings/preferences.ts` (nuovo, puro): chiavi `dropin:pref:badge:v1`, `readBool`/`writeBool` con fallback.
- `lib/app-info.ts` (nuovo): `APP_VERSION = "0.1.0"` (unica fonte, niente `import package.json` nel client).
- `app/(dashboard)/profile/page.tsx`: link "Impostazioni".
- `tests/unit/settings-preferences.test.ts` (nuovo).
- `docs/design/specs/impostazioni.md` (nuovo).

**Comportamento.**

- **Notifiche**: "Avvisi nell'app" apre `/notifications`; lo switch del pallino salva la preferenza e la applica al badge della campanella (se presente). Push: riga non interattiva, testo "Non disponibili in questa versione: richiedono l'invio dal server". Non chiedere `Notification.requestPermission()`.
- **Posizione**: mostra `granted` / `denied` / `prompt` / `unsupported`; se `denied`, istruzioni per il browser; "Riprova" richiama `getCurrentPosition` con timeout breve e aggiorna lo stato. Non salvare coordinate.
- **Account**: email da sessione; "Modifica nickname" apre il drawer del profilo; "Esci" apre conferma ("Vuoi uscire?"), su conferma `supabase.auth.signOut()` + `router.replace("/")` + `router.refresh()`.
- **Informazioni**: versione, attribuzione OpenFreeMap/OpenMapTiles, link a `https://www.openstreetmap.org/copyright`, nota licenza font (OFL).
- Errori: se `signOut` fallisce, messaggio inline con "Riprova"; nessun toast isolato come recovery.

**Regole.**

- Nessuna voce di menu che non faccia nulla. Se una funzione non esiste, la riga è assente o esplicitamente disabilitata con spiegazione.
- Switch con `role="switch"`, `aria-checked`, label associata; stato non solo colore.
- La pagina sta in `(dashboard)`: header "Indietro", nessuna bottom nav.
- Nessun token nuovo; nessun colore hardcoded.

**Acceptance.**

- `/settings` protetta dal middleware: da non loggato reindirizza al login e, dopo l'accesso, torna a `/settings` (`d1`).
- I quattro stati della posizione sono raggiungibili (DevTools → Sensors / permessi sito).
- Lo switch del pallino persiste dopo reload e con `localStorage` assente non crasha.
- "Esci" termina la sessione e porta a `/`; nessun loop.
- Nessuna chiamata a `Notification.requestPermission`.
- `npx vitest run tests/unit/settings-preferences.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi.
- `@tester` verifica live 360/768 con screenshot e console pulita.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/settings-preferences.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /settings → permessi posizione (DevTools), switch badge, logout
```

**Riferimenti.** `docs/roadmap.md` (push parziale), `docs/design/prototypes/settings.html`, `docs/design/1.5.md` (F3).

## Resolution

Implementato il 2026-11-10 (branch `fix/d18-f3`).

**Sezioni** (`app/(dashboard)/settings/page.tsx`, server, guard fail-open +
`loginRedirectUrl("/settings")` come `profile/page.tsx`; middleware: aggiunto
`"settings"` a `PROTECTED_SEGMENTS` in `lib/auth/routes.ts`):
Notifiche (`notifications-section.tsx`), Posizione (`location-section.tsx`),
Account (`account-section.tsx`), Informazioni (`info-section.tsx`, server).

**Stati permesso** (`checking` → `prompt`“Da chiedere” / `granted`“Consentita” /
`denied`“Negata” + istruzioni Safari/Chrome / `unsupported`“Non supportata”):
- `navigator.permissions.query({name:"geolocation"})` in try/catch; se assente
  o lancia (Safari: niente voce `geolocation` in Permissions) → fallback
  `prompt`, mai crash. `getCurrentPosition` con timeout 8s su "Riprova";
  `PERMISSION_DENIED` → `denied`, altri errori → `prompt`. Coordinate mai
  salvate. Live region `role=status` ("Posizione consentita. Ora puoi fare
  check-in."). Verificati live: `prompt` (default) e `granted` (permessi
  concessi via Playwright); `denied`/`unsupported` per mappatura codici.
- Permessi negati/non supportati: nessun crash, badge + testo dedicati,
  per `denied` guida di riattivazione per-browser; nessun loop di richiesta.

**Logout**: drawer Base UI "Vuoi uscire?" (copy vincolante) → `signOut()` +
`router.replace("/")` + `router.refresh()`; errore inline con "Riprova".
Verificato live: logout → `/`, poi `/settings` → login. Nessun loop.

**Esiti comandi**: `vitest settings-preferences` 7/7; `lint` 0 errori
(1 warning pre-esistente in `scripts/check-design.mjs`); `tsc` pulito;
`lint:design` OK (78 file); `test:a11y` 3/3; live Playwright 360/768:
redirect anon `307 → /?login=required&next=%2Fsettings`, render autenticato
completo, switch persiste (`dropin:pref:badge:v1` → "0"), toast Sonner,
axe 0 violazioni su `/settings` autenticato, console pulita.
Screenshot: `/tmp/opencode/d18-settings-auth-360.png`,
`/tmp/opencode/d18-settings-auth-768.png` (+ anon `d18-settings-360/768.png`).
Spec: `docs/design/specs/impostazioni.md`.

**Scostamenti**:
- `profile/page.tsx` NON toccato (link "Impostazioni" al merge: altra lane
  sta riscrivendo la pagina).
- "Informativa privacy" / "Segnala un problema" omesse: il prototipo ne
  rimanda le destinazioni a d18 e non esiste alcuna destinazione reale
  (regola ticket: nessuna voce che non faccia nulla).
- "Avvisi nell'app" → `/notifications` (dead link temporaneo: diventa valido
  al merge di d22, che crea `app/(dashboard)/notifications/page.tsx`).
- Mai chiamato `Notification.requestPermission` (verificato via grep).
- Nota env (non committata, solo verifica): con `NEXT_PUBLIC_SUPABASE_URL`
  relativo (`/supabase`) il cookie browser (`sb-localhost-auth-token`) non
  è letto dal server (`127.0.0.1` → altro storage key) — vale anche per
  `/profile` (pre-esistente). Verifica autenticata eseguita con
  `SUPABASE_INTERNAL_URL=http://localhost:54321` solo sul server dev 3115.
