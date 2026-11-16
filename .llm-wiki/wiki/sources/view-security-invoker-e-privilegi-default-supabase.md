---
type: source
title: "View `security_invoker` su Supabase: la RLS passa, i grant di scrittura no"
slug: view-security-invoker-e-privilegi-default-supabase
status: insight
category: "source"
created: 2026-11-16
updated: 2026-11-16
---

# View `security_invoker` su Supabase: la RLS passa, i grant di scrittura no

# View `security_invoker` su Supabase: la RLS passa, i grant di scrittura no

Le **default privileges** di Supabase concedono ad `anon`/`authenticated`
`INSERT/UPDATE/DELETE/TRIGGER` sulle view nuove del schema `public`. Su una view
di aggregato è inutile (le view non si scrivono) ma è sbagliato: la migrazione
deve fare `REVOKE ALL ON public.<view> FROM anon, authenticated;` **prima** del
`GRANT SELECT`. Senza il revoke il grant finale non toglie nulla.

`CREATE VIEW ... WITH (security_invoker = true)` fa applicare al chiamante la
RLS delle tabelle sotto: è il modo per esporre un aggregato senza duplicare le
policy e senza leakare righe che l'utente non può vedere (verificato: una
pending non compare nell'aggregato vista da anon).

## RLS test: attenzione ai pass vacui

Un'asserzione del tipo "anon vede 0 recensioni della corte X" può passare per il
motivo sbagliato: se la subselect per id restituisce `NULL` (perché la corte
pending è invisibile alla RLS di `courts`), il filtro è vuoto anche senza RLS
sulla tabella nuova. Aggiungere sempre il **totale** (`select count(*) from
tabella` senza filtro): è l'unico che distingue "filtro vuoto" da "RLS che
nasconde".

## Related

- `obs-2026-08-23-fix-grant-mancanti-su-courts-smoke-test-rivela-42501`
- `sport-null-visibile-con-qualsiasi-filtro`
