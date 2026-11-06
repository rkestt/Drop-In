-- Fix karma penalty: check-ins are court-based and may not carry lobby_id.
-- Penalize lobby participants with no active check-in for the same court.
CREATE OR REPLACE FUNCTION decrement_karma_on_missed_check_in()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IN ('open', 'in_progress') THEN
    UPDATE profiles
    SET karma_score = karma_score - 3
    WHERE user_id IN (
      SELECT lp.user_id
      FROM lobby_participants lp
      JOIN lobbies l ON l.id = lp.lobby_id
      WHERE lp.lobby_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.court_id = NEW.court_id
            AND ci.status = 'active'
        )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;