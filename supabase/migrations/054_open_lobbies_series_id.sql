-- 054_open_lobbies_series_id.sql
-- Lane A della #89 (disgiunta dal foglio): `open_lobbies` (037) restituisce
-- `series_id`, altrimenti il foglio della home non puo' mostrare il chip
-- "Ricorrente" (#92) che `/lobbies` gia' mostra via join diretto su
-- `lobbies.series_id` (nearby-lobbies.tsx).
--
-- Aggiunta additiva (regola docs/rpc.md): solo la 12esima colonna in coda a
-- RETURNS TABLE + SELECT (`l.series_id`); filtri (orizzonte 36h, sport NULL,
-- geo), ordinamento, LIMIT e `SET search_path = public` invariati dalla 037.
-- La funzione resta LANGUAGE sql STABLE INVOKER come la 037 (mai DEFINER:
-- da DEFINER scavalcherebbe la RLS su `lobbies` per anon).
-- DROP + CREATE con ri-grant nello stesso file (ogni DROP azzera i grant).

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
  status text, court_name text, court_sport text, participants_count bigint,
  sport text, duration_minutes integer, ends_at timestamptz,
  series_id uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT l.id, l.court_id, l.start_time, l.max_players, l.status,
         c.name, c.sport, pc.cnt,
         l.sport, l.duration_minutes, l.ends_at,
         l.series_id
  FROM public.lobbies l
  JOIN public.courts c ON c.id = l.court_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.lobby_participants lp
    WHERE lp.lobby_id = l.id
  ) pc ON true,
  origin o
  WHERE l.status = 'open'
    -- #91: orizzonte "Vicine" 36h, prima del LIMIT.
    AND l.start_time < NOW() + INTERVAL '36 hours'
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

REVOKE ALL ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
