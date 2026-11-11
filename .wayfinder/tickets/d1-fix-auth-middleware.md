---
id: d1
type: bug
hitl: false
claimed: true
blocked_by: []
status: closed
closed_at: 2026-11-09
---
## Question

**Obiettivo.** Il middleware non deve trasformare un problema di rete in un 500 e non deve perdere la pagina richiesta dopo il login.

**Sintomo (tre bug nello stesso punto).**

1. **500 offline.** `lib/supabase/middleware.ts` chiama `supabase.auth.getUser()` senza `try/catch`. Il matcher di `middleware.ts` copre quasi tutto, quindi offline o con Supabase irraggiungibile ogni navigazione (anche `/` e `/~offline`) può finire in errore invece che nella pagina o nel fallback offline. Evidenza: `docs/research/pwa-offline.md`, sezione "Gotcha specifico di questo repo".
2. **Destinazione persa.** `middleware.ts` reindirizza a `/?login=required` senza `next`. Chi apre `/profile` o `/lobbies` da non loggato, dopo l'accesso finisce sulla mappa. `app/(app)/page.tsx` legge `login` ma non `next`; `LoginModal` non riceve nessuna destinazione; il callback OAuth non la propaga.
3. **Prefissi troppo larghi.** `protectedPrefixes.some((p) => pathname.startsWith(p))` protegge anche `/profiles` e `/lobbying`: falsi positivi.

**File coinvolti.**

- `lib/auth/routes.ts` (nuovo): `isProtectedPath(pathname)`, `safeNext(value)`, `loginRedirectUrl(pathname, search)`.
- `lib/supabase/middleware.ts`: `getUser()` dentro `try/catch` con timeout 3s; su errore considera l'utente anonimo (fail-open).
- `middleware.ts`: usa `isProtectedPath` e passa `next`.
- `components/auth/login-modal.tsx`: prop `next?: string`; la passa a `signInWithOAuth` (`redirectTo: ${origin}/api/auth/callback?next=...`); dopo il login con password usa `router.replace(safeNext(next))` + `router.refresh()` invece di `window.location.reload()`.
- `app/(app)/page.tsx`: legge `next` dalla query string e lo passa al `LoginModal`; sanitizza con `safeNext`.
- `app/api/auth/callback/route.ts`: valida `next` con `safeNext` prima del redirect.
- `tests/unit/auth-routes.test.ts` (nuovo).

**Regole.**

- `safeNext` accetta solo path relativi che iniziano con `/`, non `//`, non `/\`, non URL assoluti (`http:`, `https:`, `javascript:`), default `/`. Mantiene query e hash.
- `isProtectedPath` confronta il **primo segmento** del path: `/profile` e `/profile/x` sì, `/profiles` no; `/lobbies` e `/lobbies/x` sì, `/lobbying` no.
- Fail-open solo sull'errore di rete: se non c'è sessione, le route protette reindirizzano come oggi. Nessun redirect loop su `/`.
- Il redirect di login conserva path + query: `/lobbies?tab=mine` → `/?login=required&next=%2Flobbies%3Ftab%3Dmine`.

**Acceptance.**

- I casi di `safeNext` e `isProtectedPath` sopra sono coperti da test unitari verdi.
- Con Supabase fermo (`npx supabase stop`): `/` risponde 200, `/courts/<id>` risponde 200, `/~offline` risponde 200, `/profile` e `/lobbies` reindirizzano al login senza 500.
- Login da `/profile` → si atterra su `/profile`, non su `/`.
- Login da `/lobbies?tab=nearby` → si atterra su `/lobbies?tab=nearby`.
- `safeNext("//evil.com")` e `safeNext("https://evil.com")` restituiscono `/`.
- Nessun `window.location.reload()` nel login.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design` verdi.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/auth-routes.test.ts
npm run lint
npx tsc --noEmit
npm run lint:design
# manuale: npx supabase stop && npm run dev
# poi aprire /, /courts/<id>, /~offline, /profile, /lobbies
```

**Riferimenti.** `docs/research/pwa-offline.md` (§4), `app/api/auth/callback/route.ts`, `docs/design/1.5.md` (F0).

## Resolution

- **Test aggiunti** (`tests/unit/auth-routes.test.ts`, 20 casi verdi): `safeNext`
  (default `/`, path validi, query+hash preservati, rigetto di `//evil.com`,
  `/\`, backslash, `http(s):`, `javascript:`, `data:`, path senza `/`
  iniziale, whitespace interno; trim degli spazi esterni), `isProtectedPath`
  (primo segmento: `/profile`, `/profile/x`, `/lobbies`, `/lobbies/x`,
  `/dashboard` sì; `/profiles`, `/lobbying`, `/`, `/courts/<id>`,
  `/~offline` no; query/hash ignorati), `loginRedirectUrl`
  (`/lobbies`+`?tab=mine` → `/?login=required&next=%2Flobbies%3Ftab%3Dmine`,
  con/senza `?` iniziale, round-trip via `safeNext`).
- **Comandi/esiti** (dal worktree, branch `fix/d1-f0`): `npx vitest run`
  6 file / 54 test verdi (20 nuovi); `npm run lint` 0 errori (1 warning
  pre-esistente in `scripts/check-design.mjs`, non toccato);
  `npx tsc --noEmit` pulito; `npm run lint:design` OK (61 file).
- **Route toccate**: nuovo `lib/auth/routes.ts`
  (`safeNext`/`isProtectedPath`/`loginRedirectUrl`);
  `lib/supabase/middleware.ts` (`getUser()` in `try/catch` con timeout 3s,
  fail-open a utente anonimo, redirect via `isProtectedPath` +
  `loginRedirectUrl` con `next`); `middleware.ts` radice invariato
  (delega già a `updateSession`, logica nel lib); `app/(app)/page.tsx`
  (legge+sanitizza `next`, lo passa al modal, pulisce `login`+`next`
  dall'URL); `components/auth/login-modal.tsx` (prop `next`, OAuth con
  `redirectTo .../callback?next=...`, password login con
  `router.replace(destination)` + `router.refresh()`, niente più
  `window.location.reload()` nel login); `app/api/auth/callback/route.ts`
  (`next` validato con `safeNext`).
- **Resta da verificare manualmente** (orchestratore, Supabase non toccato):
  `npx supabase stop && npm run dev`, poi `/` → 200, `/courts/<id>` → 200,
  `/~offline` → 200, `/profile` e `/lobbies` → redirect login senza 500;
  login da `/profile` atterra su `/profile`; login da
  `/lobbies?tab=nearby` atterra su `/lobbies?tab=nearby`.

## Resolution — review oracle (secondo giro)

1. **Regressione navigazione (fix).** `LoginModal`: prop `next?: string` senza
   default navigante; nuovo helper `resolveLoginDestination(next)` in
   `lib/auth/routes.ts` (`undefined`/`null` → `undefined` = resta dove sei,
   altrimenti `safeNext`). Login password: `router.replace` solo se
   `destination !== undefined`, poi sempre `router.refresh()`. OAuth: `?next=`
   appeso al callback solo se richiesto, altrimenti `redirectTo` base come
   prima. `app/(app)/page.tsx`: `loginNext: string | undefined`, passa `next`
   esplicito solo se `?login=required&next=...` presente; `submit-court` e
   `login-prompt` (senza `next`) restano sulla pagina dopo il login —
   coerente con `docs/design/patterns/onboarding.md:130` (gate che riprende
   lo step esatto). Niente component test: la toolchain vitest 4.1/rolldown
   del repo non riesce a caricare alcun `.tsx` (entry o import, statico o
   dinamico) sotto env jsdom — "Unexpected JSX expression" / "jsx:
   preserve" da `vite:import-analysis`; anche `esbuild.jsx: automatic` in
   `vitest.config.ts` è ignorato. Sistemarlo tocca tsconfig/build: fuori
   scope. Il contratto è fissato dai test di `resolveLoginDestination`
   (undefined→stay, esplicito→sanitizzato, ostile→`/`), che il modal usa
   direttamente; il branch `if (destination !== undefined)` è 3 righe
   revisionate a vista.
2. **Guardie in-page (fix).** `app/(dashboard)/profile/page.tsx` e
   `app/(dashboard)/lobbies/page.tsx`: `getUser()` in `try/catch` fail-open
   (stessa semantica del middleware) + redirect via `loginRedirectUrl`
   (`/profile`; `/lobbies` con `?tab=` preservato da `searchParams`
   — in Next 15 è `Promise`, quindi `await`ato).
3. **Test fail-open middleware (nuovo `tests/unit/supabase-middleware.test.ts`,
   6 casi verdi, `vi.mock("@supabase/ssr")` riuscito senza DI):** `getUser`
   che rigetta → `/`, `/courts/<id>`, `/~offline` 200 senza redirect e senza
   throw; `/profile`, `/lobbies?tab=nearby` → 307 verso
   `/?login=required&next=...`; lookalike `/profiles`, `/lobbying` non
   reindirizzati; `getUser` che pende mai + `timeoutMs: 5` (timeout
   parametrizzato via `opts`, default 3000 invariato) → redirect; utente
   presente → nessun redirect; sessione vuota senza errore → redirect.
4. **Minori.** `createServerClient` spostato dentro il `try` (throw sincrono
   → fail-open); commento scheme-regex in `safeNext` corretto onestamente
   (belt-and-braces irraggiungibile dopo i check sul `/` iniziale, tenuto
   contro futuri riordini). Test oracle aggiunti: `%2F%2Fevil.com` → `/`,
   `/%5cevil` pass-through (no decode in `safeNext`), `\n`/`\r`/`\t` → `/`,
   `/foo:bar` e `/../x` consentiti (normalizzazione al server), `null`,
   `/PROFILE` → false, `/dashboard/` → true, `//profile` → false; fragment
   tagliato in `loginRedirectUrl` by design (il browser non lo invia mai).
- **Comandi/esiti finali** (worktree, branch `fix/d1-f0`): `npx vitest run`
  7 file / 68 test verdi; `npm run lint` 0 errori (1 warning pre-esistente
  invariato); `npx tsc --noEmit` pulito; `npm run lint:design` OK (61 file).
- **Resta manuale** (non eseguito di proposito): `supabase stop` + dev
  server; `/`→200, `/courts/<id>`→200, `/~offline`→200, `/profile` e
  `/lobbies`→redirect login senza 500; atterraggio post-login su `/profile`
  e `/lobbies?tab=nearby`; assenza di loop su `/`.

## Resolution — prova offline (orchestratore, 2026-11-09)

Supabase fermo (`npx supabase stop`), dev server su porta 3210, `curl`
senza sessione:

| Route | Esito |
|---|---|
| `/` | **200**, nessun 500 |
| `/~offline` | **200**, nessun 500 |
| `/profile` | **307** → `/?login=required&next=%2Fprofile` |
| `/lobbies` | **307** → `/?login=required&next=%2Flobbies` |
| `/lobbies?tab=nearby` | **307** → `/?login=required&next=%2Flobbies%3Ftab%3Dnearby` |
| `/profiles`, `/lobbying` | 404 (route inesistenti, **non** protette: nessun falso positivo) |
| `/courts/<id>` | **404**, non 500 |

Nota sull'ultima riga: la pagina campo fa una query server-side e
`notFound()` quando il dato non arriva; con Supabase spento il middleware
non lancia (obiettivo del ticket rispettato), ma la pagina non può
restituire 200 senza il dato. L'acceptance "`/courts/<id>` → 200" è
realizzabile solo con la shell offline + dati in cache di `d24` (o con il
service worker in produzione dopo una prima visita), non in dev senza
Supabase. Nessun redirect loop su `/`; nessun 500 su nessuna route provata.

La verifica dell'atterraggio post-login (password e OAuth) resta non
eseguita: richiede credenziali reali. Path coperto dai test unitari
(`resolveLoginDestination` + round-trip `loginRedirectUrl`→`safeNext`) e dal
redirect osservato sopra.
