---
type: source
title: "Guard trigger su una tabella con proprietario: il path del creatore va pinnato"
slug: guard-trigger-pinna-creator-id
status: insight
category: "sources"
created: 2026-11-18
updated: 2026-11-18
---

# Guard trigger su una tabella con proprietario: il path del creatore va pinnato

# Guard trigger su una tabella con proprietario: il path del creatore va pinnato

Trovato in review su #92 (`044_lobby_series.sql`), non da un test.

## La trappola

Un guard `BEFORE UPDATE` che dice "se sei il creatore puoi tutto" e fa `RETURN NEW` senza controlli lascia riscrivibile **la colonna di proprietà**. Via PostgREST l'UPDATE passa, e il creatore può cedere la riga a un altro uid o metterla a `NULL` (auto-orfanizzazione, perdendo il controllo che la RLS gli dà).

Le policy `FOR UPDATE USING (...)` **non** impediscono questo: senza `WITH CHECK` la nuova riga non viene validata, e anche con `WITH CHECK` il confronto con il vecchio valore non è esprimibile in policy. Serve il guard.

## La forma che regge

```sql
IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
  RAISE EXCEPTION 'creator_id immutabile' USING ERRCODE = 'insufficient_privilege';
END IF;
```

Stesso stile dei check già presenti per i path "partecipante" e "kill-switch": prima si pinna l'immutabile, poi si decide cosa il ruolo può cambiare.

## Corollario: `auth.uid() IS NULL`

Un guard che fa `IF auth.uid() IS NULL THEN RETURN NEW` (cron, cascade `SET NULL`, service_role) è sicuro **solo** perché anon non ha grant UPDATE e nessuna policy passa senza claim. È una proprietà del grant, non del guard: se qualcuno concede UPDATE ad anon, quel ramo diventa una porta. Verificarlo quando si legge, non assumerlo.

## Related

- trigger e `search_path`: [[join-rotto-trigger-notify-invoker-permessi]]
- la semantica delle serie: `docs/roadmaps/core-loop.md`, migrazione `044`
