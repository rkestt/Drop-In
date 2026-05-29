-- Migration: Auto-join lobby creators as participants
-- Backfills lobby_participants for existing lobbies where creator is not already a participant
-- Also adds trigger to auto-join creator on future lobby creation

-- Step 1: Backfill existing lobbies
INSERT INTO lobby_participants (lobby_id, user_id)
SELECT l.id, l.creator_id
FROM lobbies l
WHERE NOT EXISTS (
  SELECT 1 FROM lobby_participants lp
  WHERE lp.lobby_id = l.id AND lp.user_id = l.creator_id
)
ON CONFLICT (lobby_id, user_id) DO NOTHING;

-- Step 2: Create trigger function to auto-join creator as participant
CREATE OR REPLACE FUNCTION auto_join_creator_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lobby_participants (lobby_id, user_id)
  VALUES (NEW.id, NEW.creator_id)
  ON CONFLICT (lobby_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on lobbies table
DROP TRIGGER IF EXISTS trigger_auto_join_creator ON lobbies;
CREATE TRIGGER trigger_auto_join_creator
AFTER INSERT ON lobbies
FOR EACH ROW
EXECUTE FUNCTION auto_join_creator_as_participant();
