-- Update get_lobby_participants RPC to return user_id (for profile linking)
-- Privacy is enforced by RLS on profiles + SECURITY DEFINER on get_public_profile

CREATE OR REPLACE FUNCTION get_lobby_participants(p_lobby_id UUID)
RETURNS TABLE(user_id UUID, nickname TEXT, joined_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lp.user_id, p.nickname, lp.joined_at
  FROM lobby_participants lp
  JOIN profiles p ON p.user_id = lp.user_id
  WHERE lp.lobby_id = p_lobby_id;
$$;
