---
id: d1
type: bug
hitl: false
claimed: false
blocked_by: []
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

(TBD — chiudere con: test aggiunti, esito della prova offline, route verificate, eventuale nota in `docs/research/pwa-offline.md`.)
