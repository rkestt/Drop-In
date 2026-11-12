-- 023_sport_null_visible.sql
-- Chiude #71 (issue) e #72: le corti con `sport IS NULL` erano invisibili
-- appena un filtro sport era attivo. Sui dati OSM attuali e' il 63% delle
-- corti, quindi il filtro sport svuotava la mappa per la maggior parte degli
-- utenti.
--
-- DECISIONE PRODOTTO (implementare, non ri-discutere qui): NULL significa "sport non
-- specificato" ed e' visibile con QUALUNQUE filtro sport. La UI lo dice
-- esplicitamente ("Sport non specificato", vedi `sportDisplayLabel` in
-- lib/courts/search.ts) cosi' chi filtra "padel" sa che lo sport della corte
-- e' ignoto. Default temporaneo in attesa del backfill sport (#63).
--
-- Copre le tre RPC di lettura con predicato sport: `nearby_courts` (corpo
-- dalla 022), `open_lobbies` (corpo dalla 021), `courts_in_viewport` (corpo
-- dalla 018). Firme, colonne, ordinamenti, escaping di `p_query`, `SET
-- search_path`, SECURITY INVOKER/STABLE invariati: cambia solo il predicato
-- sport. Ogni DROP azzera i GRANT, quindi si revocano/ri-concedono nello
-- stesso file come fanno 012/022 (service_role in piu' solo per
-- `nearby_courts`, come la 022).

-- ============================================================================
-- nearby_courts: corpo dalla 022 + `c.sport IS NULL OR` nel predicato sport.
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
  photo_path TEXT
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
         c.photo_path
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
-- service_role in più come la 022 (script di GC/diagnostica con service key);
-- nessun allargamento RLS, la funzione resta SECURITY INVOKER.
GRANT EXECUTE ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- open_lobbies: corpo dalla 021 + `c.sport IS NULL OR` nel predicato sport.
-- ============================================================================
DROP FUNCTION IF EXISTS public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE FUNCTION public.open_lobbies(
  p_sport TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_m DOUBLE PRECISION DEFAULT 15000
)
RETURNS TABLE (
  id uuid, court_id uuid, start_time timestamptz, max_players integer,
  status text, court_name text, court_sport text, participants_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT l.id, l.court_id, l.start_time, l.max_players, l.status,
         c.name, c.sport, pc.cnt
  FROM public.lobbies l
  JOIN public.courts c ON c.id = l.court_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.lobby_participants lp
    WHERE lp.lobby_id = l.id
  ) pc ON true,
  origin o
  WHERE l.status = 'open'
    -- #71: NULL = sport non specificato, visibile con qualunque filtro sport.
    AND (p_sport IS NULL OR c.sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    -- Senza coordinate il filtro geo e' spento (compatibilita' con la 013).
    AND (p_lat IS NULL OR p_lng IS NULL
         OR ST_DWithin(c.location, o.g, COALESCE(p_radius_m, 15000)))
  ORDER BY
    -- Senza coordinate: stesso ordinamento della 013. Con coordinate: KNN
    -- per distanza (il CASE valuta un solo ramo, mai ST_Distance su NULL).
    CASE WHEN p_lat IS NULL OR p_lng IS NULL
      THEN EXTRACT(EPOCH FROM l.start_time)
      ELSE ST_Distance(c.location, o.g) END ASC,
    l.start_time ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

-- Le lobby sono pubbliche: grant esplicito dopo revoca totale (come 012 punto
-- 10 e 013: il boot di Supabase applica grant ad anon, la REVOKE da PUBLIC
-- sola non basta). Firma aggiornata ai 5 parametri.
REVOKE ALL ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;

-- ============================================================================
-- courts_in_viewport: corpo dalla 018 + `c.sport IS NULL OR` nel predicato.
-- 13 colonne esplicite invariate (nessuna colonna aggiunta o tolta).
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
  source TEXT, photo_path TEXT, moderation_status TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.status, c.sport, c.venue_type, c.source, c.photo_path, c.moderation_status
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
