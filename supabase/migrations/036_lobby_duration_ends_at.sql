-- 036_lobby_duration_ends_at.sql
-- Chiude #96 (parte dati): la durata vive sulla Lobby, la chiusura e' una
-- colonna generata.
--
-- - `lobbies.sport TEXT NULL`: sport della Lobby, valorizzato alla creazione
--   dal Campo se univoco, altrimenti scelto nel drawer. NULL = ignoto
--   (stessa prudenza di #71: sport ignoto da un lato = compatibile).
-- - `duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (15..240)`: il
--   mapping sport->durata vive in costante applicativa
--   (`lib/sport/sports.ts`), non in un CHECK: i valori si ritoccano con i
--   dati della beta. Righe esistenti: backfill implicito a 30.
-- - `ends_at` generata da `(start_time, duration_minutes)`: la stessa
--   aritmetica esisteva in due copie che divergevano (`auto_close_lobbies`
--   in SQL, `formatAppCloseTime` in TS) — era il bug del ticket. Ora c'e'
--   una sola fonte, il cron e il client leggono senza sommare.
-- - `open_lobbies` DROPpata e ricreata con `sport, duration_minutes,
--   ends_at`; grant ri-concessi (ogni DROP azzera i grant, vedi docs/rpc.md).
--   `nearby_courts` e `courts_in_viewport` non si toccano (restituiscono
--   Campi).

ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS sport TEXT NULL,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (duration_minutes BETWEEN 15 AND 240);

-- `timestamptz + interval` e' STABLE (dipende dal fuso: DST), e le
-- generated column vogliono espressioni IMMUTABLE (42P17). Giro in UTC con
-- gli overload `timezone(text, …)` che sono IMMUTABLE; l'UTC non ha DST,
-- quindi l'istante assoluto e' preservato. Verificato su PG locale.
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ
    GENERATED ALWAYS AS (
      timezone('UTC', timezone('UTC', start_time) + make_interval(mins => duration_minutes))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_lobbies_ends_at_open
  ON public.lobbies (ends_at)
  WHERE status IN ('open', 'in_progress');

-- Il cron chiude sulle `ends_at`, non piu' su start_time + 30' fissi.
CREATE OR REPLACE FUNCTION auto_close_lobbies()
RETURNS VOID AS $$
BEGIN
  UPDATE lobbies
  SET status = 'closed'
  WHERE status IN ('open', 'in_progress')
    AND ends_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- open_lobbies: stesse semantica/filtri/ordinamento della 023, piu'
-- `sport, duration_minutes, ends_at` della Lobby in uscita.
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
  status text, court_name text, court_sport text, participants_count bigint,
  sport text, duration_minutes integer, ends_at timestamptz
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
         l.sport, l.duration_minutes, l.ends_at
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

REVOKE ALL ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
