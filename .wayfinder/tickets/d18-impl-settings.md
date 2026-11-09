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

(TBD — chiudere con: sezioni, stati permesso, esito logout, screenshot, spec.)
