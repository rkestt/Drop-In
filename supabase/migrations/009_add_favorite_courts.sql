-- Add favorite_court_ids array column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS favorite_court_ids UUID[] DEFAULT '{}';

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_favorite_court_ids ON profiles USING GIN(favorite_court_ids);

-- RLS policy: users can update their own favorite_court_ids (already covered by existing policy)