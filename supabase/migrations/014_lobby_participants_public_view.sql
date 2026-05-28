-- View pubblica per nascondere user_id raw
CREATE OR REPLACE VIEW public_lobby_participants AS
SELECT lp.lobby_id, p.nickname, lp.joined_at
FROM lobby_participants lp
JOIN profiles p ON p.user_id = lp.user_id;

-- Rimuovi accesso pubblico diretto alla tabella
DROP POLICY IF EXISTS "Lobby participants are viewable by everyone" ON lobby_participants;

-- Gli utenti autenticati vedono solo le proprie partecipazioni (per gestione personale)
CREATE POLICY "Users can view own participations"
  ON lobby_participants
  FOR SELECT
  USING (auth.uid() = user_id);

-- RPC: elenco pubblico partecipanti di una lobby (senza user_id)
CREATE OR REPLACE FUNCTION get_lobby_participants(p_lobby_id UUID)
RETURNS TABLE(nickname TEXT, joined_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nickname, lp.joined_at
  FROM lobby_participants lp
  JOIN profiles p ON p.user_id = lp.user_id
  WHERE lp.lobby_id = p_lobby_id;
$$;

-- RPC: conteggio partecipanti per batch di lobby
CREATE OR REPLACE FUNCTION get_lobby_counts(p_lobby_ids UUID[])
RETURNS TABLE(lobby_id UUID, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lp.lobby_id, COUNT(*)::BIGINT
  FROM lobby_participants lp
  WHERE lp.lobby_id = ANY(p_lobby_ids)
  GROUP BY lp.lobby_id;
$$;

-- RPC: verifica se l'utente corrente è iscritto a una lobby
CREATE OR REPLACE FUNCTION is_user_in_lobby(p_lobby_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM lobby_participants
    WHERE lobby_id = p_lobby_id AND user_id = auth.uid()
  );
$$;

-- Grant
GRANT SELECT ON public_lobby_participants TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_lobby_participants(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_lobby_counts(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_user_in_lobby(UUID) TO anon, authenticated;
