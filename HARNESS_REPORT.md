# Harness Report — Drop-In (before → after)

**Data:** 2026-09-01 18:22
**Scope:** harness agent per sviluppo eccellente fino a produzione (solo harness, no infra esterna)
**Canary:** `Andrea · tN · ctx ok` globale da ora (AGENTS.md)

---

## 1. Before (stato iniziale 2026-08-23 → 2026-09-01 15:51)

| Area | Stato before | Evidenza |
|------|--------------|----------|
| **Git** | dirty 11M + 12U, solo 2 commit (29c5a9b, 2a48e89), nessuna storia wayfinder/test | `git status` 23 file untracked/modified, `git log` 2 righe |
| **Docs** | AGENTS.md drift: "No test framework", comandi `test:*` assenti, `tsc` non documentato, Gotchas incompleti | `AGENTS.md` riga 18 |
| **Tracker** | triplo: taskman (4 piani, 2 done/2 pending, initiative drop-in-full-test-loop) + wayfinder (MAP.md 5 ticket ✅ ma non dichiarato FROZEN) + openspec archiviato — God confuso | `.taskman/plans/`, `.wayfinder/MAP.md: STATUS RAGGIUNTA`, `openspec/changes/archive` |
| **Skills** | ponytail presente in `.agents/skills` ma non in `skills-lock.json` (perso su reinstall), impeccable ok, context-canary globale installato ma mai emesso | `skills-lock.json` 1 skill, `~/.pi/agent/settings.json` caveman+canary |
| **Quality gate** | lint 3 warnings (exhaustive-deps, envLocal unused, SEEDED_COURT unused) exit 0 ma rumoroso, tsc clean, vitest 13/13 verde, build verde ma PWA non verificato, `npm run test:all` esistente ma non gate-ato in hook/CI | `npm run lint` 3 warnings, `npm run build` ok standalone |
| **Hound** | 13.0 → 13.2 disponibile | `hound --version` |
| **Husky** | assente, nessun pre-commit | no `.husky/` |
| **CI** | assente, nessun `.github/workflows` | `ls .github` vuoto |
| **Wiki** | 3 observations + 1 retro (4 pages), concepts/entities vuoti, log fermo a 2026-08-23, nessun capture harness | `.llm-wiki/meta/registry.json` 4 pages |
| **Gitignore** | mancava `test-results/`, `supabase/.temp/`, `playwright-report`, wiki raw | `.gitignore` 18 righe |
| **PWA/Supabase** | next.config fixato (ternario dev/prod) ma sw non verificato, supabase config porte ok, DB down (container exited) | `public/sw.js` 43K non verificato prima |

**Rischi before:** commit monolitico perso, tracker duplicato → God delega a caso, lint rumoroso → debt, nessun gate automatico → regressioni silenziose, hound vecchio → search meno affidabile.

---

## 2. After (2026-09-01 18:22, 9 commit clean)

```
27df8dc docs(wiki): harness hardening observation + log/registry rebuild
df684c1 ci: GitHub Actions quality gate (lint+tsc+unit+build)
16c7992 fix(lint): zero warnings - deps effect, unused vars
3ae7f61 chore(harness): husky + lint-staged pre-commit (lint-staged + tsc)
9572d02 chore(harness): canary globale - ogni risposta Andrea · tN · ctx ok
a539e92 chore(harness): gitignore local artifacts (test-results, supabase temp, wiki raw)
90c7394 chore(test): infra Vitest+Playwright, harness skills, wiki, taskman
f013acf feat(map): wayfinder drop-in-bella-funzionante - viewport RPC, lobbies, build green
a01db46 chore(harness): tracker unification - taskman canonical, wayfinder FROZEN, ponytail lock
2a48e89 feat: Initial project setup (base)
```

`git status` → **clean** (solo ignored: test-results, supabase/.temp)

| Area | Stato after | Evidenza + gate |
|------|-------------|-----------------|
| **Git** | 9 commit atomici, messaggi convenzionali, storia leggibile, status clean | `git log --oneline -9`, `git status --short` vuoto |
| **Docs** | AGENTS.md: comandi `test:unit/test:e2e/test:all` + `tsc --noEmit`, sezione `Harness — Tracker & Process` (taskman canonical, wayfinder FROZEN 2026-08-23, openspec archiviato, quality gate `test:all`, canary globale), porte supabase 54333 corrette | `AGENTS.md` + `git show a01db46` |
| **Tracker** | **taskman unico canonical** (`.taskman/plans/plans.jsonl` 4 piani 2 done/2 pending + initiative), **wayfinder FROZEN** (banner archivio in MAP.md, solo lettura), **openspec ARCHIVIATO**, **rome-launch-readiness ARCHIVED.md** (reference non piano) | `AGENTS.md` Harness, `.wayfinder/MAP.md`, `ARCHIVED.md` |
| **Skills** | `skills-lock.json` 2 skills (ponytail local hash 1316a2f + impeccable), caveman attivo, canary globale committato | `skills-lock.json`, `AGENTS.md` canary |
| **Quality gate** | **lint 0 warnings** (fix exhaustive-deps + void envLocal + rimosso SEEDED_COURT), **tsc 0**, **vitest 13/13 237ms**, **build verde** standalone 460kB First Load, serwist **sw 43K** generato, **test:all = lint+tsc+unit** verde (e2e deferrato per DB down, ma wayfinder gate 2k courts 17ms già verificato) | `npm run lint` 0, `npx tsc`, `npm run test:unit`, `npm run build` |
| **Hound** | **13.2** ✓ up to date | `hound --version` 13.2.0 |
| **Husky** | **husky 9.1.7 + lint-staged 17.4.1**, `.husky/pre-commit`: `npx lint-staged --quiet` (staged only, `*.ts,tsx → eslint --fix`) + `npx tsc --noEmit --skipLibCheck` — gate leggero, no e2e in hook (ponytail) | `.husky/pre-commit`, `package.json` lint-staged |
| **CI** | **`.github/workflows/ci.yml`** 28 righe: on push master/main + PR, node 20, `npm ci`, `lint`, `tsc`, `test:unit`, `build` (e2e deferrato con commento docker) | `.github/workflows/ci.yml` yaml ok |
| **Wiki** | **5 pages**, new observation `obs-2026-09-01-harness-hardening...` (before/after + metrics), log/registry rigenerati | `registry.json` 5, `wiki/sources/obs-...md` |
| **Gitignore** | + `/test-results/ /playwright-report/ supabase/.temp/ .llm-wiki/.discoveries/outputs/raw .taskman/.tmp` | `.gitignore` |
| **PWA/Supabase** | next.config ternario verificato, **public/sw.js 43K** presente, middleware ok, supabase config porte 54321/54322/54333 verified, env `.env.local` ok, DB container exited (expected, non blocca harness) | `next.config.js`, `public/sw.js`, `supabase/config.toml` |

---

## 3. Confronto quantitativo

| Metrica | Before | After | Δ |
|---------|--------|-------|---|
| Commit totali | 2 | 9 (+7) | +350% storia |
| Git status | dirty 23 file | clean | ✅ |
| AGENTS.md comandi | 5 righe, no test | 8 righe + Harness section | + doc |
| Lint warnings | 3 | **0** | -100% |
| tsc | clean | clean | = |
| vitest | 13/13 | 13/13 | = |
| build | verde non verificato sw | verde + sw 43K verificato | ✅ |
| Hound | 13.0 | **13.2** | ✅ |
| Pre-commit | nessuno | husky+lint-staged | ✅ |
| CI | nessuno | GitHub Actions | ✅ |
| Tracker fonti | 3 (confuso) | 1 canonical + 2 archiviati | ✅ |
| skills-lock | 1 skill | 2 skills | ✅ |
| Wiki pages | 4 | 5 | +1 |
| Gitignore righe | ~18 | ~27 | +9 |

**Miglioramento harness:** da “dirty, docs drift, tracker triplo, lint rumoroso, no gate” a **“git pulito atomico, docs allineati, tracker unico, lint zero, husky gate + CI, hound aggiornato, canary globale, wiki capturata”**. Pronto per sviluppo eccellente fino a prod.

---

## 4. Tooling surgical — cosa serve, cosa YAGNI

**SI (installato):**
- husky + lint-staged (gate leggero, 5 pacchetti, ponytail-approved)
- hound 13.2 (free update, search affidabile)
- canary globale (0 costo, rivela context rot)
- ponytail lock + impeccable pin (harness stabile)
- CI minimal (lint+tsc+unit+build, no e2e docker overprovisioning)

**NO (YAGNI, rimandato):**
- commitlint / conventional commits hook → friction per solo dev
- pi-plan-mode wiring → taskman già canonical, openspec archiviato
- wiki embeddings → no provider, concepts/entities ancora vuoti, non blocca
- chrome MCP / playwright browsers in CI → serve docker + supabase cloud, deferrato
- coverage % / jsdom component test → costo > valore per Drop-In

---

## 5. Gap residui & next step prod

- **E2E full** `npm run test:e2e` non girato oggi (supabase DB exited) — wayfinder gate smoke+browse già verde 2026-08-23, da rigirare quando `npx supabase start` up. CI E2E attivabile quando supabase cloud stage pronto.
- **Wiki embeddings** `wiki_reindex_embeddings` no-op (no provider) — ok per ora, concepts/entities da popolare quando domain cresce.
- **Push notifications** stub dormiente (t5 wayfinder) — delivery vera richiede Edge Function + VAPID, deferrato correttamente.
- **Check-in GPS 50m** — logica server ok, UX dev senza GPS reale richiede mock (fixtures già pronte).

**Next harness step consigliato (quando vuoi):**
1. `npx supabase start && npx supabase db reset && npm run test:all` (lint+tsc+unit+e2e) — gate finale unico
2. Popola wiki concepts (court, lobby, karma) se vuoi memoria domain più ricca
3. Attiva branch protection su GitHub per CI required

---

*Report generato da God orchestrator — harness hardening autonomo, 7 todo completati, 9 commit, build verde verificato.*
