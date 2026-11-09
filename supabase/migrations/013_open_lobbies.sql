-- 013_open_lobbies.sql
-- Lobby aperte con filtro sport server-side e conteggio partecipanti.
-- Il client caricava 20 lobby e filtrava per sport a valle del limit: con 20
-- lobby di basket in testa, un utente tennis vedeva "Nessuna lobby attiva".
-- Qui filtro + join avvengono PRIMA del LIMIT, quindi p_sport='tennis' trova
-- le lobby tennis anche se sommerse dal basket.
--
-- SECURITY INVOKER (default, nessun SECURITY DEFINER): la funzione eredita la
-- RLS del chiamante. Nessun filtro su moderation_status: una lobby su una
-- corte pending/rejected e' visibile solo a chi puo' vedere quella corte
-- (policy courts_select_all), come per gli altri RPC di lettura.

CREATE OR REPLACE FUNCTION public.open_lobbies(
  p_sport TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id uuid, court_id uuid, start_time timestamptz, max_players integer,
  status text, court_name text, court_sport text, participants_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.id, l.court_id, l.start_time, l.max_players, l.status,
         c.name, c.sport, pc.cnt
  FROM public.lobbies l
  JOIN public.courts c ON c.id = l.court_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.lobby_participants lp
    WHERE lp.lobby_id = l.id
  ) pc ON true
  WHERE l.status = 'open'
    AND (p_sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
  ORDER BY l.start_time ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

-- Le lobby sono pubbliche: grant esplicito dopo revoca totale (come 012 punto
-- 10: il boot di Supabase applica grant ad anon, la REVOKE da PUBLIC sola non
-- basta).
REVOKE ALL ON FUNCTION public.open_lobbies(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobbies(TEXT, INTEGER) TO anon, authenticated;
