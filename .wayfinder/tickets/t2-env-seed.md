---
id: t2
type: task
hitl: true
claimed: true
blocked_by: [t1]
---
## Question
Runtime mai testato: serve `.env.local` (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY da `supabase status`) e Docker per `npx supabase start` + seed 10k courts (`scripts/seed_courts.sql`). Checklist per human. Risoluzione: app gira su localhost con dati.

## Resolution
**Risolto**: runtime up su porte standard API 54321 / DB 54322; studio/inbucket spostati su 54333/54334 nel config.toml per collisione con progetto supabase 'relay' (lasciato intatto). `.env.local` scritto, `db reset` ok, **10130 courts seeded**. Nessun codice app toccato.
