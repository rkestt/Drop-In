-- 050_court_name_flag.sql
-- Chiude #106 (lane A DB-flag): distingue i nomi generati da quelli veri.
--
-- Flag = colonna booleana `courts.is_auto_name` (decisione @oracle su #106:
-- niente enum PG — il repo non ne usa: `sport` e' TEXT con allowlist negli
-- RPC, `moderation_status` e' TEXT + CHECK in 010; la provenienza esiste gia'
-- come `courts.source` = osm/community). Default false: i nomi veri restano
-- intatti, solo il backfill e l'import marcano i generici.
--
-- Backfill: `name IN ('Spazio aperto', 'Campo senza nome')` (i due default
-- generati: `DEFAULT_NAME` in scripts/extract_osm.py e `'Campo senza nome'`
-- di `submit_court` in 031) -> etichetta del `venue_type` con lo STESSO
-- mapping di `generic_name_for_venue` in scripts/extract_osm.py (lane B, gia'
-- in repo e gia' referente `courts.is_auto_name` nell'upsert: questa
-- migrazione e' cio' che rende valido quell'upsert). Niente sport nel nome
-- (un generico "Basket" matcherebbe migliaia di righe via p_query ILIKE) e
-- niente quartiere (non esiste nessuna colonna zona nel pipeline: fuori
-- scope, dichiarato in #106). `open_space`/ignoti -> 'Campo' (fallback
-- DEFAULT_NAME dell'import: backfill e import futuri producono gli stessi
-- nomi, cosi' il ramo generico-su-generico dell'upsert resta stabile).
-- I 526 nomi OSM veri restano intoccati con is_auto_name=false.
--
-- `nearby_courts` e `courts_in_viewport` (firme in 023) aggiungono
-- `is_auto_name` IN CODA a RETURNS TABLE + SELECT: aggiunta retrocompatibile
-- (regola in docs/rpc.md), ordine delle colonne esistenti invariato.
-- DROP + ri-GRANT nello stesso file (ogni DROP azzera i grant, modello 012
-- punto 10) e SET search_path = public (gate check:search-path, #102).
-- `open_lobbies` NON si tocca (mostra court_name dal join, la scheda e' un
-- tap dopo). Idempotente: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.

-- ============================================================================
-- Flag + indice parziale (serve solo a contare/monitorare i residui, non a
-- filtrare le RPC).
-- ============================================================================
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS is_auto_name BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_courts_is_auto_name
  ON public.courts(is_auto_name) WHERE is_auto_name;

-- ============================================================================
-- Backfill: solo i due default generati diventano etichette venue + flag.
-- LEFT(...,6) invece di LIKE 'field_%' (l'underscore in LIKE e' wildcard).
-- ============================================================================
UPDATE public.courts
SET name = CASE
  WHEN LEFT(venue_type, 6) = 'field_' THEN 'Campo'
  WHEN venue_type = 'park' THEN 'Parco'
  WHEN venue_type = 'playground' THEN 'Parco giochi'
  WHEN venue_type = 'recreation_ground' THEN 'Area ricreativa'
  WHEN venue_type = 'green_space' THEN 'Spazio verde'
  ELSE 'Campo'
END,
is_auto_name = true
WHERE name IN ('Spazio aperto', 'Campo senza nome');

-- ============================================================================
-- nearby_courts: corpo dalla 023 + `c.is_auto_name` in coda (SELECT e RETURNS
-- TABLE). Firma e predicati invariati.
-- ============================================================================
DROP FUNCTION IF EXISTS public.nearby_courts(double precision, double precision, double precision, integer, text, text);

CREATE FUNCTION public.nearby_courts(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 15000,
  p_limit INTEGER DEFAULT 200,
  p_sport TEXT DEFAULT NULL,
  p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, surface_type TEXT, hoop_count INTEGER,
  venue_type TEXT, sport TEXT, status TEXT, distance_m DOUBLE PRECISION,
  photo_path TEXT, is_auto_name BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.venue_type, c.sport, c.status,
         ST_Distance(c.location, o.g) AS distance_m,
         c.photo_path, c.is_auto_name
  FROM public.courts c, origin o
  WHERE COALESCE(c.status, 'active') = 'active'
    AND ST_DWithin(c.location, o.g, p_radius_m)
    -- #71: NULL = sport non specificato, visibile con qualunque filtro sport.
    AND (p_sport IS NULL OR c.sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    AND (p_query IS NULL
         OR c.name ILIKE '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\')
  ORDER BY c.location <-> o.g
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
-- service_role in piu' come la 022/023 (script di GC/diagnostica con service key);
-- nessun allargamento RLS, la funzione resta SECURITY INVOKER.
GRANT EXECUTE ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- courts_in_viewport: corpo dalla 023 + `c.is_auto_name` in coda. 13 colonne
-- esistenti invariate (ordine e nomi identici), solo la 14esima si aggiunge.
-- ============================================================================
DROP FUNCTION IF EXISTS public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT);

CREATE FUNCTION public.courts_in_viewport(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_results INTEGER DEFAULT 2000,
  p_sport TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, surface_type TEXT, hoop_count INTEGER,
  status TEXT, sport TEXT, venue_type TEXT,
  source TEXT, photo_path TEXT, moderation_status TEXT,
  is_auto_name BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.status, c.sport, c.venue_type, c.source, c.photo_path, c.moderation_status,
         c.is_auto_name
  FROM public.courts c
  WHERE c.status = 'active'
    AND c.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    -- #71: NULL = sport non specificato, visibile con qualunque filtro sport.
    AND (p_sport IS NULL OR c.sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
  LIMIT max_results;
$$;

REVOKE ALL ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) TO anon, authenticated;
