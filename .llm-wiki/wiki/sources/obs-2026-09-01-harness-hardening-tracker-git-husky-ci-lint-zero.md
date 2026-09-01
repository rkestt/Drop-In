# ⭐ Observation: Harness hardening — tracker, git, husky, lint zero, CI

**Relevance:** high
**Observed:** 2026-09-01
**Source:** harness hardening session God

## Prima (before)
- git dirty 11M+12U, 2 commit iniziali, zero storia wayfinder/test
- AGENTS.md drift: "No test framework", comandi incompleti (no test:*, no tsc)
- Tracker triplo: taskman (4 piani 2 done/2 pending) + wayfinder (FROZEN ma non dichiarato) + openspec archiviato — God confuso
- Lint 3 warnings (exhaustive-deps, unused envLocal, unused SEEDED_COURT), tsc clean ma non gate-ato, vitest 13/13, build verde ma PWA non verificato
- Hound 13.0 → 13.2 disponibile, no husky, no pre-commit, canary non globale
- Ponytail skill presente ma non lockata in skills-lock.json
- Wiki 3 observations + 1 retro, nessun capture harness, gitignore mancava test-results/supabase.temp

## Dopo (after)
- git: 5 commit atomici + husky + lint zero + CI = 8 commit puliti, status clean (solo ignored)
  - `a01db46` tracker unification (AGENTS.md + wayfinder FROZEN + ponytail lock + ARCHIVED)
  - `f013acf` feat map viewport RPC + lobbies tabs + build green
  - `90c7394` chore test infra (vitest+playwright 13 verdi + fixtures + skills + wiki + taskman)
  - `a539e92` gitignore local artifacts + `9572d02` canary globale + `3ae7f61` husky/lint-staged + `16c7992` lint zero + `df684c1` CI
- AGENTS.md: comandi test:* completi, sezione Harness Tracker & Process (taskman canonical, wayfinder FROZEN, openspec archiviato, gate test:all, canary globale)
- Wayfinder: MAP.md banner FROZEN, taskman unico source
- Lint: 3 → 0 warnings, tsc clean, vitest 13/13, build verde verified (serwist sw 43K, 6 routes, First Load 104kB)
- Hound: 13.0 → 13.2 ✓, husky 9.1.7 + lint-staged 17.4.1 pre-commit (lint-staged --quiet + tsc), CI GitHub Actions quality gate (lint+tsc+unit+build)
- Ponytail lockata, impeccable pinned, skills-lock completo
- Gitignore: + test-results/playwright-report/supabase.temp/wiki raw + canary globale commit
- Wiki: 5 pages, log rigenerato, nuova observation harness hardening

## Gap residui (YAGNI rimandati, ponytail)
- CI E2E (playwright + supabase docker) deferrato — serve supabase cloud o docker in CI
- Wiki embeddings non indicizzati (no provider), concept/entity ancora vuoti
- Push notifications ancora stub (deferito da wayfinder t5)
- Check-in GPS 50m mock solo in test, non in UX prod

## Decisione tooling surgical
- SI: husky, hound update, canary globale, ponytail lock, CI minimal
- NO: commitlint, plan-mode wiring, wiki embeddings ora, chrome MCP — YAGNI
