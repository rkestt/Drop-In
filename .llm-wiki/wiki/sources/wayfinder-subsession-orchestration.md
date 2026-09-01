---
type: source
title: Wayfinder map execution via parallel subsessions
status: insight
category: devops
created: 2026-08-23
updated: 2026-08-23
slug: wayfinder-subsession-orchestration
---

# Wayfinder map execution via parallel subsessions

Orchestrazione mappa wayfinder drop-in-bella-funzionante completata. Pattern che ha funzionato:

1. **Ticket meccanici → subsession async immediate**: t1 (build green) e t2 (env/seed) lanciati come subagent async in parallelo appena aperta la sessione.
2. **Ticket HITL/grilling → raggruppati in UNA ask_user_question** mentre i subagent lavorano in background: le 3 decisioni prodotto (t3 viewport PostGIS, t4 due tab, t5 push deferito) prese senza idle time.
3. **Implementazioni parallele con file disgiunti** via workflowScript runs.all: t3 (mappa), t4 (lobbies), t5 (push) su file diversi. Collisione attesa e gestita: t4 ha visto WIP di t3 su page.tsx e ha correttamente segnalato invece di toccare.
4. **Gate finale unico da orchestrator**: i figli girano build/tsc nello stesso cwd (.next contention possibile) → la verifica vera (build+tsc+lint+DB smoke) la fa God dopo che tutti finiscono. Ha trovato: migrazione 004 mai applicata (creata dopo il db reset di t2) e ignores eslint mancanti (.agents/**, supabase/.temp/**).

Risultato: build verde, 10130 courts seeded, RPC courts_in_viewport 2000 righe/17ms, lint exit 0.

Vedi [[wayfinder-orchestration-patterns]] per i dettagli dei fix del gate finale.

*Category: devops*

---
*Captured: 2026-08-23*

## Related

_Add links to related pages._
