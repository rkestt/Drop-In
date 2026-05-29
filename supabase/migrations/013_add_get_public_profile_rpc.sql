-- RPC: get_public_profile
-- Returns public profile data + aggregated stats (check-ins count, lobbies participated)
-- Does NOT return: email, banned_until, favorite_court_ids, detailed check-in history

CREATE OR REPLACE FUNCTION get_public_profile(p_user_id UUID)
RETURNS TABLE (
  nickname TEXT,
  avatar_url TEXT,
  karma_score INTEGER,
  total_check_ins BIGINT,
  total_lobbies_participated BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.nickname,
    p.avatar_url,
    p.karma_score,
    (SELECT COUNT(*) FROM check_ins ci WHERE ci.user_id = p.user_id)::BIGINT AS total_check_ins,
    (SELECT COUNT(DISTINCT lp.lobby_id) FROM lobby_participants lp WHERE lp.user_id = p.user_id)::BIGINT AS total_lobbies_participated
  FROM profiles p
  WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
