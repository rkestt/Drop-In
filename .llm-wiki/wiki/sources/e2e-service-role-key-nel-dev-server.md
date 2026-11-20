---
type: source
title: "e2e: una route con service-role vuole la chiave nel dev server, non solo nel runner"
slug: e2e-service-role-key-nel-dev-server
status: insight
category: "source"
created: 2026-11-20
updated: 2026-11-20
---

# e2e: una route con service-role vuole la chiave nel dev server, non solo nel runner

# e2e: una route con service-role vuole la chiave nel dev server, non solo nel runner

## Sintomo

Una spec e2e che esercita `POST /api/account/delete` passava in locale con la chiave esportata a mano, ma su un clone pulito il gate falliva: la route legge `process.env.SUPABASE_SERVICE_ROLE_KEY` (`app/api/account/delete/route.ts`) **nel processo del dev server**, mentre `test:all` esporta solo `E2E_WITH_DB`. Ogni POST tornava 500 `account.delete_failed`, step `config`.

## Perché il runner non basta

Playwright ha due processi: il runner (dove gira lo spec) e il `webServer` (`npm run dev`). `helpers/auth.ts` risolve la chiave con un fallback alla chiave demo locale, quindi fixture e cleanup funzionano; la route no, perché eredita solo `webServer.env`. Lo spec così è rosso su clone pulito e verde sulla macchina di chi ha esportato la variabile: la peggiore delle asimmetrie.

## Fix

In `playwright.config.ts`, `webServer.env` inietta la chiave demo locale **solo se il target è locale**:

```ts
const E2E_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL ?? "";
function isLocalSupabaseTarget(raw: string): boolean {
  if (raw === "") return true;                       // default dev: proxy /supabase
  if (/\.supabase\.co(\/|$)/.test(raw)) return false; // mai staging/prod
  return raw.startsWith("/") || /127\.0\.0\.1|localhost/.test(raw);
}
env: { TZ: "UTC", ...(isLocalSupabaseTarget(E2E_SUPABASE_URL) ? { SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY } : {}) }
```

Perché è sicuro: è il JWT deterministico del secret di default dello stack Supabase locale, valore già committato in `tests/e2e/helpers/auth.ts`; nel processo del dev server dei test resta server-only (nessun prefisso `NEXT_PUBLIC_`), non entra nel build, e contro un URL remoto non viene iniettata affatto.

Da non fare: `test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY)` (gate verde senza aver provato nulla, la lezione di #98) o affidarsi a `.env.local` (gitignored: il problema resta su ogni clone).

## Corollario sulle fixture

`admin.auth.admin.createUser` restituisce già `data.user.id`: farlo tornare da `createConfirmedUser` evita i tre `listUsers({ perPage: 200 })` sparsi nelle spec, che senza paginazione sono un flake latente quando il DB locale si riempie di utenti e2e.

## Related

- [test:all verde perché metà degli e2e si skippa senza E2E_WITH_DB](test-all-verde-perche-meta-degli-e2e-si-skippa.md)
- [e2e di Drop-In: fallimenti spuri dal chunk corrotto del dev server](e2e-fallimenti-spuri-chunk-dev-server.md)
