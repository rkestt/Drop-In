-- 021_open_lobbies_geo.sql
-- #48 (Fase B): la home filtra le lobby per RAGGIO DALL'ORIGINE (15 km),
-- stessa semantica di /lobbies, invece di mostrare tutta Italia.
--
-- p_lat/p_lng/p_radius_m opzionali con default: senza coordinate il WHERE
-- geografico e' spento e l'ordinamento resta start_time (identico alla 013),
-- quindi i chiamanti esistenti continuano a funzionare.
-- Con coordinate: ST_DWithin su courts.location (geography, stesso stile di
-- nearby_courts nella 009) + ordinamento KNN per distanza.
--
-- Nota: Postgres non permette CREATE OR REPLACE con una firma diversa
-- (resterebbe un secondo overload senza filtro geo): DROP dell'overload
-- (TEXT, INTEGER) e ricreazione a 5 parametri, poi grant sulla nuova firma.

DROP FUNCTION IF EXISTS public.open_lobbies(TEXT, INTEGER);

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
    AND (p_sport IS NULL OR c.sport = 'multi'
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
