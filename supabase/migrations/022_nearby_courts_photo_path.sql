-- 022_nearby_courts_photo_path.sql
-- Per la issue #68 la home usera' nearby_courts con p_query per la ricerca
-- per raggio dal centro mappa, invece del filtro in memoria. La home pero'
-- mostra le miniature delle corti (#66) e la RPC non ritornava photo_path.
-- Questa migrazione sostituisce la definizione della 020 (corpo copiato
-- tale e quale, firma identica con gli stessi 6 parametri e default) e
-- aggiunge solo `photo_path text` in coda al RETURNS TABLE.
-- La funzione resta SECURITY INVOKER (nessuna clausola SECURITY, come la
-- 020): nessun ALTER su RLS/policy, la RLS resta l'unico filtro di lettura.
-- Il DROP azzera i GRANT, quindi si revocano/ri-concedono come fa la 012.

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
    AND (p_sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    AND (p_query IS NULL
         OR c.name ILIKE '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\')
  ORDER BY c.location <-> o.g
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
-- service_role in più rispetto alla 012: il DROP azzera tutti i GRANT e la
-- service key (script di GC/diagnostica) invoca le RPC come gli altri ruoli;
-- nessun allargamento RLS, la funzione resta SECURITY INVOKER.
GRANT EXECUTE ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO anon, authenticated, service_role;
