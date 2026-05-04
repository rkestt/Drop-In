-- Migration 002: Push notification trigger functions
-- Requires: push_notifications table from 001_initial_schema.sql

-- 9.2: Notify participants 15 minutes before lobby start
-- This function is called by a pg_cron job every 5 minutes
CREATE OR REPLACE FUNCTION notify_lobby_starting_soon()
RETURNS VOID AS $$
BEGIN
  INSERT INTO push_notifications (user_id, title, body, data)
  SELECT
    lp.user_id,
    'La lobby sta per iniziare!',
    'La lobby al campo ' || c.name || ' inizia tra 15 minuti.',
    jsonb_build_object(
      'type', 'lobby_starting_soon',
      'lobby_id', l.id,
      'court_id', l.court_id,
      'start_time', l.start_time
    )
  FROM lobbies l
  JOIN courts c ON c.id = l.court_id
  JOIN lobby_participants lp ON lp.lobby_id = l.id
  WHERE l.status = 'open'
    AND l.start_time > NOW() + INTERVAL '13 minutes'
    AND l.start_time < NOW() + INTERVAL '17 minutes'
    AND NOT EXISTS (
      -- Avoid duplicate notifications already sent
      SELECT 1 FROM push_notifications pn
      WHERE pn.user_id = lp.user_id
        AND pn.data->>'type' = 'lobby_starting_soon'
        AND pn.data->>'lobby_id' = l.id::text
    );
END;
$$ LANGUAGE plpgsql;

-- 9.3: Notify lobby creator when new participant joins
CREATE OR REPLACE FUNCTION notify_participant_joined()
RETURNS TRIGGER AS $$
DECLARE
  lobby_creator_id UUID;
  participant_nickname TEXT;
  court_name TEXT;
BEGIN
  -- Get the lobby creator and court name
  SELECT l.creator_id, c.name
  INTO lobby_creator_id, court_name
  FROM lobbies l
  JOIN courts c ON c.id = l.court_id
  WHERE l.id = NEW.lobby_id;

  -- Get the joining user's nickname
  SELECT nickname INTO participant_nickname
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Don't notify if the joiner is the creator themselves
  IF NEW.user_id != lobby_creator_id THEN
    INSERT INTO push_notifications (user_id, title, body, data)
    VALUES (
      lobby_creator_id,
      'Nuovo partecipante!',
      COALESCE(participant_nickname, 'Un giocatore') || ' si è unito alla tua lobby a ' || COALESCE(court_name, 'un campo'),
      jsonb_build_object(
        'type', 'participant_joined',
        'lobby_id', NEW.lobby_id,
        'user_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger first if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_notify_participant_joined ON lobby_participants;

CREATE TRIGGER trigger_notify_participant_joined
AFTER INSERT ON lobby_participants
FOR EACH ROW
EXECUTE FUNCTION notify_participant_joined();

-- 9.4: Notify on karma loss (missed check-in)
-- Extends the existing decrement_karma_on_missed_check_in function
-- This is handled by modifying the existing function to also insert a notification
CREATE OR REPLACE FUNCTION decrement_karma_on_missed_check_in()
RETURNS TRIGGER AS $$
DECLARE
  affected_user RECORD;
  court_name TEXT;
BEGIN
  IF NEW.status = 'closed' AND OLD.status IN ('open', 'in_progress') THEN
    -- Get court name
    SELECT c.name INTO court_name
    FROM courts c
    WHERE c.id = NEW.court_id;

    FOR affected_user IN
      SELECT lp.user_id, p.nickname
      FROM lobby_participants lp
      JOIN profiles p ON p.user_id = lp.user_id
      WHERE lp.lobby_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.lobby_id = NEW.id
            AND ci.status = 'active'
        )
    LOOP
      -- Decrement karma
      UPDATE profiles
      SET karma_score = GREATEST(karma_score - 3, 0)
      WHERE user_id = affected_user.user_id;

      -- Send notification about karma loss
      INSERT INTO push_notifications (user_id, title, body, data)
      VALUES (
        affected_user.user_id,
        'Karma perso',
        'Non hai fatto check-in per la lobby a ' || COALESCE(court_name, 'un campo') || '. Hai perso 3 punti Karma.',
        jsonb_build_object(
          'type', 'karma_loss',
          'lobby_id', NEW.id,
          'points_lost', 3
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Schedule the lobby starting soon check (runs every 5 minutes)
SELECT cron.schedule('notify-lobby-starting-soon', '*/5 * * * *', 'SELECT notify_lobby_starting_soon()');
