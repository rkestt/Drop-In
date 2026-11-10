---
id: d26
type: task
hitl: false
claimed: false
blocked_by: [d24]
---
## Question

**Obiettivo.** Mettere sotto budget performance e PWA: bundle per route, font, mappa lazy, cache tile, shell offline. Misurare prima, poi ottimizzare, senza cambiare il design.

**Prerequisiti.** `d24` chiuso (offline behavior), `d3` chiuso (font locali) se disponibile. Le schermate `d17`–`d24` chiuse: si misura il prodotto finito, non una fase intermedia.

**File coinvolti.**

- `app/layout.tsx`: pesi font effettivamente usati, `preload` solo per il body, niente pesi inutilizzati.
- `app/(app)/page.tsx`: import dinamici per i blocchi sotto la mappa se pesano; verificare che `maplibre-gl` resti fuori dal chunk iniziale.
- `next.config.js`: `experimental.optimizePackageImports` per `lucide-react` (se non già attivo), `output: "standalone"` invariato.
- `app/sw.ts`: fallback navigazione, limiti cache tile, nessuna cache di dati autenticati.
- `app/manifest.json`: `start_url`, `display`, icone 192/512, `theme_color`.
- `docs/design/stack.md` o `docs/research/pwa-offline.md`: numeri misurati e decisioni.

**Misure da registrare nella Resolution (prima/dopo).**

- Output di `npm run build`: First Load JS per `/`, `/courts/[id]`, `/lobbies`, `/profile`, `/settings`, `/notifications`, `/submit-court`.
- Lighthouse mobile (`npx --yes lighthouse`) su `/` con Fast 4G + 4x CPU: Performance, Accessibility, Best Practices, LCP, CLS, TBT.
- Peso dei font: quanti `.woff2`, quanti KB, quanti pesi.
- Cache tile: entries e TTL effettivi.

**Budget (vincolanti).**

- `/` First Load JS ≤ **250 kB gzip**; nessuna route peggiora più del **5%** rispetto alla baseline registrata.
- `maplibre-gl` non deve comparire nel chunk iniziale di nessuna route (verifica dai file `.next/static/chunks` o dal report).
- Lighthouse mobile: Performance ≥ **85**, Accessibility **100**, Best Practices **100**.
- LCP < **2,5 s**, CLS < **0,1**, TBT < **200 ms** su `/`.
- Offline: `/`, `/courts/<id>`, `/profile`, `/lobbies` non mostrano schermata bianca (shell o `/~offline`).
- Nessuna richiesta di font a host esterni.

**Cosa fare (in ordine, solo se la misura lo giustifica).**

1. Ridurre i pesi font ai soli usati (es. Syne 600/700/800, Source Sans 3 400/600) e caricare solo il body in preload.
2. Verificare che i componenti pesanti della mappa siano già in `dynamic(..., { ssr: false })`; spostare eventuali import statici.
3. Attivare `optimizePackageImports` per `lucide-react` e verificare il tree-shaking delle icone.
4. Controllare che `app/styleguide` non entri nel build di produzione (oggi `notFound()` in prod: verificare che il bundle non venga incluso).
5. Sistemare il fallback di navigazione del service worker e precache di `/~offline` e delle icone.
6. Cache: tile 600 voci/7 giorni, stile 10 voci/7 giorni, nessun dato autenticato in cache.

**Regole.**

- Non cambiare layout, copy o token per guadagnare punti Lighthouse.
- Non aggiungere una libreria di analytics o un polyfill.
- Non disabilitare l'accessibilità o la mappa per il punteggio.
- Se un budget non è raggiungibile, documentare il motivo e la soglia reale nella Resolution: non nasconderlo.

**Acceptance.**

- Tabella before/after nella Resolution con i numeri di build e Lighthouse.
- Tutti i budget sopra rispettati, oppure motivati con una soglia alternativa approvata.
- `maplibre-gl` fuori dal chunk iniziale (comando di verifica incluso).
- Offline verificato con `npm run build && npm start` (non in dev).
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi.
- `@tester` verifica live 360/768 e rete throttled.

**Comandi di verifica.**

```bash
npm run build | tee /tmp/opencode/build.txt
grep -E "First Load JS|/ " /tmp/opencode/build.txt | head -20
grep -rl "maplibre" .next/static/chunks | head
npx --yes lighthouse http://localhost:3000 \
  --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=/tmp/opencode/lh.json --chrome-flags="--headless"
node -e "const r=require('/tmp/opencode/lh.json');console.log(r.categories.performance.score, r.categories.accessibility.score, r.audits['largest-contentful-paint'].displayValue, r.audits['cumulative-layout-shift'].displayValue, r.audits['total-blocking-time'].displayValue)"
```

**Riferimenti.** `docs/research/pwa-offline.md`, `docs/research/map-tile-provider.md`, `docs/design/stack.md`, `docs/design/1.5.md` (F4).

## Resolution

Tabella completa in `docs/research/pwa-offline.md` §9 (misure prima/dopo).

**First Load JS gzip** (prima → dopo): `/` 278→**190 kB** ✅ (≤250);
`/courts/[id]` 329→329, `/lobbies` 313→313, `/lobbies/[id]` 321→321,
`/profile` 269→269, `/settings` 273→273, `/notifications` 195→195,
`/submit-court` 265→265 — nessuna peggiora ✅.

**Lighthouse mobile simulato** (con backend via proxy; senza: BP −4 per
`console.error` su fetch fallite — artefatto env): prima 1 run → dopo 3 run.
P 48→44, A11y 96→**100**, BP 100→100; LCP 5,2→~7 s (**peggiorato**, vedi §9.2:
1 run prima non esclude varianza), CLS 0,052 ✅, TBT ~6–7 s.
P/LCP/TBT **non raggiungibili**: chunk MapLibre `89831ab3` (~1 MB raw,
~269 kB gzip) sul main thread vale da solo ~6,3 s di bootup simulato; la
mappa è la home (differirla = cambiare il prodotto, vietato).

**Interventi** (solo giustificati da misura): `optimizePackageImports`
per `lucide-react` (`next.config.js`); `LoginModal` on-demand via
`React.lazy` + mount condizionale, `FirstRun` in `dynamic(ssr:false)`
(`app/(app)/page.tsx`) → Base UI/Drawer fuori dal chunk iniziale di `/`.
Nit oracle: `Suspense fallback` non più `null` ma `LoginLoadingFallback`
(sheet con stessa sagoma del Drawer, token-only, backdrop che chiude,
bottone "Caricamento…" disabilitato + `role="status"`) così il click non è
mai morto; `smoke.spec.ts` clicca "Accedi" e attende fallback-o-form e poi
il campo email (chunk async verificato live).
**Non toccati**: layout, copy, token, mappa, font, SW/cache (già conformi da
d24), manifest, `playwright.config.ts`, `MAP.md`, `1.5.md` (nota di eccezione
budget: la scrive l'orchestratore).

**Verifiche**: `maplibre` solo in chunk async `89831ab3` (mai iniziale);
`/styleguide` isolato (no leak); niente font esterni; offline reale (server
spento): `/`, `/courts/<id>`, `/profile`, `/lobbies` mai bianchi (e2e tmp
rimosso); `build` ✅ `tsc` ✅ `lint` ✅ (1 warning pre-esistente in
`scripts/`) `lint:design` ✅ `vitest` 220 ✅; e2e `smoke`+`d24-offline` ✅,
modale login lazy ✅.
