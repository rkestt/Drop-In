-- Migration: restrict profile visibility to owner-only SELECT; expose public fields via RPC batch
-- Addresses: RLS tightening — only owner sees full profile; others see nickname, karma_score, avatar_url

BEGIN;

-- Drop old permissive SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- New owner-only SELECT policy
CREATE POLICY "Users can view own full profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Public batch-profiles RPC (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_public_profiles(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, nickname TEXT, karma_score INTEGER, avatar_url TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nickname, p.karma_score, p.avatar_url
  FROM profiles p
  WHERE p.user_id = ANY(p_user_ids);
$$;

COMMIT;
