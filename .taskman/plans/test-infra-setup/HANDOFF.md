# Test infra setup

## Perché
Zero framework di test nel repo. Ogni piano successivo dipende da questo.

## Cosa fare
1. **Deps**: `npm i -D vitest @playwright/test`. Verificare `eslint-config-next@16` vs `next@15` mismatch: se `npm run lint` fallisce, pinnare `eslint-config-next@^15` (surgical, solo versione).
2. **Vitest** (`vitest.config.ts`): environment node, include `tests/unit/**/*.test.ts`, alias `@` → root.
3. **Playwright** (`playwright.config.ts`):
   - `webServer`: `next dev -p 3100` (porta dedicata), riusa server esistente.
   - `baseURL http://localhost:3100`, retries 0 in dev/2 in CI, reporter list.
   - Env: legge `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` da `.env.local`.
4. **Seed**: `supabase/config.toml` ha seed vuoto. Creare `supabase/seed.sql` che delega a subset di `scripts/seed_courts.sql` (LIMIT ~200 courts via INSERT ... SELECT o copia ridotta) + 2 utenti di test (via SQL su auth.users o signup E2E). `npx supabase db reset` deve completare pulito — è il comando di setup per ogni sessione E2E.
5. **Fixture Playwright** (`tests/e2e/fixtures.ts`): 
   - `auth` fixture: signup/login reale via UI login-modal (o API supabase-js diretta per velocità) → storageState riusabile.
   - geolocation mock: `context.grantPermissions(['geolocation'])` + `setGeolocation` coordinate del court seedato (entro 50m) per check-in.
6. **Scripts npm**: `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`, `"test:all": "npm run lint && tsc --noEmit && npm run test:unit && npm run test:e2e"`.
7. Primo smoke test E2E: homepage carica, mappa renderizza canvas MapLibre, zero errori console.

## Vincoli
- Non toccare codice prodotto tranne mismatch deps.
- Docker deve girare per Supabase; STOP condition se `npx supabase start` fallisce.

## Verification gate
- `npx playwright test tests/e2e/smoke.spec.ts` → 1 passed (homepage + mappa + no console errors).
- `npm run test:unit` → esce 0 anche con 0 test (o con primo test placeholder).
- `npm run build` → successo.

## Precondition
Fix eslint-config-next (downgrade) tocca una dependency: Proof: `grep '"eslint-config-next"' package.json package-lock.json | head` → attesa versione ^16.2.4 in package.json. Se già ^15, skip.