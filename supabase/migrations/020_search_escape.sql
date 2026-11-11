-- 020_search_escape.sql
-- Chiude #60: p_query e' collegata (nearby_courts la usa in ILIKE) ma senza
-- escape, quindi '%' e '_' agiscono da wildcard (input '%' = nessuna ricerca).
-- Nessun client oggi passa p_query (home filtra in memoria, nearby-lobbies
-- passa solo lat/lng/raggio/limite): la correzione va nel server, cosi' vale
-- per qualunque chiamante presente e futuro, anon incluso. Firma invariata
-- -> OR REPLACE, GRANT intatti.

CREATE OR REPLACE FUNCTION public.nearby_courts(
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
  venue_type TEXT, sport TEXT, status TEXT, distance_m DOUBLE PRECISION
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
         ST_Distance(c.location, o.g) AS distance_m
  FROM public.courts c, origin o
  WHERE COALESCE(c.status, 'active') = 'active'
    AND ST_DWithin(c.location, o.g, p_radius_m)
    AND (p_sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    AND (p_query IS NULL
         OR c.name ILIKE '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\')
  ORDER BY c.location <-> o.g
  LIMIT p_limit;
$$;
