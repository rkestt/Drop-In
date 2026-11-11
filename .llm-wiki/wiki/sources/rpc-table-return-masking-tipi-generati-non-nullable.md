---
type: source
title: "RPC RETURNS TABLE: i tipi generati dicono non-null, il masking restituisce NULL"
slug: rpc-table-return-masking-tipi-generati-non-nullable
status: insight
category: "concept"
created: 2026-11-11
updated: 2026-11-11
---

# RPC RETURNS TABLE: i tipi generati dicono non-null, il masking restituisce NULL

# RPC con `RETURNS TABLE`: i tipi generati dicono non-null, il masking a runtime restituisce NULL

## Contesto

Drop-In maschera le colonne sensibili delle corti `pending` altrui dentro le RPC (migration 012, poi 018). Una RPC SQL del tipo:

```sql
RETURNS TABLE (id UUID, lat DOUBLE PRECISION, distance_m DOUBLE PRECISION, ...)
...
CASE WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
     THEN NULL ELSE c.lat END
```

restituisce `NULL` a runtime, ma `npm run types` (`supabase gen types typescript`) genera `lat: number`, `distance_m: number`. Il generatore non vede il `CASE`, vede solo il tipo dichiarato.

## Conseguenza

`tsc` resta verde mentre il codice client calcola su un `null`:

- `Math.round(null) === 0` → la card stampava "a 0 m" invece di nascondere la distanza;
- `router.push(\`/courts/\${id}\`)` con `id` null → `/courts/null`;
- `key={candidate.id}` con piu' righe mascherate → chiavi React duplicate;
- qualsiasi `photo_url`/campo rimosso da un `RETURNS TABLE` esplicito diventa `undefined` silenzioso: il compilatore non se ne accorge perche' la tabella generata e' tipata larga.

## Regola

Quando una RPC maschera o rimuove colonne in SQL, il contratto va riscritto a mano **nel tipo client** (`string | null`, `number | null`) e il render deve gestire il caso nullo. Il tipo generato è la forma della tabella, non il contratto della funzione. Non fidarsi di `tsc` come prova che il masking regge: serve un test RLS che asserisca il NULL, non il tipo.

## Verifica usata

`tests/rls/assertions.sql` §28 (§54): come non-owner la riga ha `id/lat/lng/distance_m/moderation_status/source` tutti NULL e il nome reale non compare; come owner la propria pending è integra.

## Related

- [[../sources/obs-post-1.5-fase-b-rpc-hardening]]
