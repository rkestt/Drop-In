# RPC pubbliche su `courts` — firme, semantica, chi le chiama

Riferimento per le RPC di lettura che il client usa per trovare campi e lobby. Le RPC di scrittura/moderazione (`submit_court`, `approve_court`, `reject_court`, `mark_duplicate`, `dedup_candidates`) stanno in `docs/moderation.md`.

Sono **due RPC diverse con due semantiche diverse**. Non sono intercambiabili e non hanno le stesse colonne in uscita: se aggiungi un campo a una, decidi esplicitamente se serve anche all'altra (e scrivi la migrazione per entrambe).

## `nearby_courts` — ricerca per raggio

Definizione corrente: `supabase/migrations/023_sport_null_visible.sql` (sostituisce la 022, che sostituiva 020/012/010).

```sql
nearby_courts(
  p_lat double precision,          -- origine
  p_lng double precision,
  p_radius_m double precision = 15000,
  p_limit integer = 200,
  p_sport text = NULL,             -- NULL = tutti; 'multi' matcha ogni sport
  p_query text = NULL              -- NULL = nessun filtro nome
)
RETURNS TABLE (
  id uuid, name text, lat double precision, lng double precision,
  address text, surface_type text, hoop_count integer, venue_type text,
  sport text, status text, distance_m double precision, photo_path text
)
```

- **Semantica**: raggio geografico da `(p_lat, p_lng)`, ordinamento KNN (`location <-> point`), `LIMIT p_limit`. Filtra `status = 'active'`; la visibilità delle corti `pending` la fa la RLS (funzione **SECURITY INVOKER**).
- **`p_query`**: `ILIKE '%...%'` sul nome, con `%`/`_` escapati (migrazione 020). È accent-sensitive: non esiste `unaccent()`, quindi "citta" non trova "Città".
- **`p_sport`**: `c.sport = 'multi'` oppure match esatto su uno dei valori separati da `;`.
- **Sport non specificato**: `sport IS NULL` significa "sport non specificato" ed è **visibile con qualunque filtro sport** (decisione prodotto #71/#72, default temporaneo in attesa del backfill #63). La UI lo dichiara con "Sport non specificato" (`sportDisplayLabel` in `lib/courts/search.ts`), così chi filtra "padel" sa che lo sport della corte è ignoto invece di vedere una riga vuota.
- **Non ritorna** `source` né `moderation_status`.
- **Chiamata da**: `components/lobby/nearby-lobbies.tsx` (raggio 15 km, senza query) e `app/(app)/page.tsx` (ricerca: raggio 25 km dal centro mappa, con `p_query`, debounce 300 ms — il seam puro è `lib/courts/search.ts`).

## `courts_in_viewport` — browse per bounding box

Definizione corrente: `supabase/migrations/023_sport_null_visible.sql` (era la 018).

```sql
courts_in_viewport(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision,
  max_results integer = 2000,
  p_sport text = NULL
)
RETURNS TABLE (
  id uuid, name text, lat double precision, lng double precision,
  address text, surface_type text, hoop_count integer, status text,
  sport text, venue_type text, source text, photo_path text,
  moderation_status text
)
```

- **Semantica**: `location && ST_MakeEnvelope(...)`, **nessun ordinamento**, `LIMIT max_results`. È la mappa quando non stai cercando.
- **Non ha `p_query`**: la ricerca per nome *non* passa da qui. Aggiungerla significherebbe due implementazioni della stessa cosa — se serve, si passa a `nearby_courts`.
- **Ritorna in più** `source` e `moderation_status` rispetto a `nearby_courts` (13 colonne esplicite dalla 018, confermate nella 023).
- **Sport non specificato**: come `nearby_courts`, `sport IS NULL` è visibile con qualunque `p_sport` (#71/#72).
- **Chiamata da**: `app/(app)/page.tsx`, fetch del browse, con guardia anti-stale e cache offline (`COURTS_CACHE_KEY`). I risultati di ricerca **non** vanno in quella cache.

## `open_lobbies` — lobby per raggio

Definizione corrente: `supabase/migrations/023_sport_null_visible.sql` (era la 021).

```sql
open_lobbies(
  p_sport text = NULL, p_limit integer = 20,
  p_lat double precision = NULL, p_lng double precision = NULL,
  p_radius_m double precision = 15000
)
RETURNS TABLE (
  id uuid, court_id uuid, start_time timestamptz, max_players integer,
  status text, court_name text, court_sport text, participants_count bigint
)
```

- Senza coordinate il filtro geografico è spento e l'ordine è `start_time`; con coordinate è raggio + KNN.
- **Sport non specificato**: le lobby su corti con `sport IS NULL` sono visibili con qualunque `p_sport` (#71/#72).
- **Non ritorna la foto del campo**: la miniatura nelle card lobby arriva da un `select` separato su `courts` (#66). Se un giorno servisse nella RPC, va aggiunta qui *e* nei due select.

## Trappole comuni

- **`DROP FUNCTION` azzera i grant**: ogni `CREATE OR REPLACE` con firma o colonne diverse richiede `DROP` + `CREATE`, quindi **ri-concedere** `EXECUTE` ad `anon`/`authenticated` (e `service_role` se serve) nello stesso file, come fanno 012 e 022.
- **Aggiungere una colonna a `RETURNS TABLE` è retro-compatibile** per i client tipizzati, ma va rigenerato `lib/supabase/database.types.ts` con `npm run types` (mai a mano).
- **Da Studio/psql la RLS non si applica** (ruolo `postgres` con `rolbypassrls`): le RPC restituiscono anche `pending`/`rejected`. Le verifiche anonime vanno fatte via REST con la publishable key.
- **`courts_in_viewport` non è "la versione grande" di `nearby_courts`**: bbox vs raggio, ordine assente vs KNN, 13 colonne vs 12. Se il client deve mostrare qualcosa in più, si sceglie la RPC giusta invece di allineare le colonne a caso.

## Verifiche rapide (REST, senza browser)

```bash
# anon: elenco corti visibili (conta)
curl -s -D- -o /dev/null "https://<ref>.supabase.co/rest/v1/courts?select=id&limit=1" \
  -H "apikey: <publishable>" -H "Prefer: count=exact" | grep -i content-range

# nearby_courts con query
curl -s "https://<ref>.supabase.co/rest/v1/rpc/nearby_courts" \
  -H "apikey: <publishable>" -H "content-type: application/json" \
  -d '{"p_lat":41.9028,"p_lng":12.4964,"p_radius_m":15000,"p_limit":2,"p_query":"parco"}'
```

## Related

- `docs/moderation.md` (RLS, masking, RPC di moderazione)
- `docs/staging.md` (ambienti e procedure remote)
- `docs/roadmap.md` (stato delle feature)
