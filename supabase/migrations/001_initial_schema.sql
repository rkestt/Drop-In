-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Courts table
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  surface_type TEXT,
  hoop_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  location GEOGRAPHY(POINT, 4326)
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  karma_score INTEGER DEFAULT 90,
  banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lobbies table
CREATE TABLE lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 10,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lobby participants table
CREATE TABLE lobby_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, user_id)
);

-- Check-ins table
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'checked_out')),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ
);

-- Court reports table
CREATE TABLE court_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('broken_hoop', 'wet_court', 'lighting', 'occupied', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Spatial index on courts
CREATE INDEX idx_courts_location ON courts USING GIST(location);

-- Additional indexes
CREATE INDEX idx_lobbies_status_court ON lobbies(status, court_id);
CREATE INDEX idx_check_ins_user_checked_out ON check_ins(user_id, checked_out_at);
CREATE INDEX idx_court_reports_court_created ON court_reports(court_id, created_at);
CREATE INDEX idx_profiles_banned_until ON profiles(banned_until);

-- Update location from lat/lng
CREATE OR REPLACE FUNCTION update_court_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_court_location
BEFORE INSERT OR UPDATE ON courts
FOR EACH ROW
EXECUTE FUNCTION update_court_location();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_courts_updated_at
BEFORE UPDATE ON courts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_lobbies_updated_at
BEFORE UPDATE ON lobbies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, karma_score)
  VALUES (NEW.id, 90);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Auto-close lobbies after 30 minutes past start_time
CREATE OR REPLACE FUNCTION auto_close_lobbies()
RETURNS VOID AS $$
BEGIN
  UPDATE lobbies
  SET status = 'closed'
  WHERE status IN ('open', 'in_progress')
    AND start_time < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Auto-checkout after 4 hours
CREATE OR REPLACE FUNCTION auto_checkout()
RETURNS VOID AS $$
BEGIN
  UPDATE check_ins
  SET status = 'checked_out', checked_out_at = NOW()
  WHERE status = 'active'
    AND checked_in_at < NOW() - INTERVAL '4 hours';
END;
$$ LANGUAGE plpgsql;

-- Remove expired bans
CREATE OR REPLACE FUNCTION remove_expired_bans()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET banned_until = NULL
  WHERE banned_until IS NOT NULL
    AND banned_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Archive old court reports
CREATE OR REPLACE FUNCTION archive_old_reports()
RETURNS VOID AS $$
BEGIN
  DELETE FROM court_reports
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cron jobs (requires pg_cron enabled in Supabase)
SELECT cron.schedule('auto-close-lobbies', '*/15 * * * *', 'SELECT auto_close_lobbies()');
SELECT cron.schedule('auto-checkout', '*/15 * * * *', 'SELECT auto_checkout()');
SELECT cron.schedule('remove-expired-bans', '0 * * * *', 'SELECT remove_expired_bans()');
SELECT cron.schedule('archive-old-reports', '0 2 * * *', 'SELECT archive_old_reports()');

-- Row Level Security policies
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_reports ENABLE ROW LEVEL SECURITY;

-- Courts: readable by all
CREATE POLICY "Courts are viewable by everyone" ON courts
  FOR SELECT USING (true);

-- Profiles: users can view all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Lobbies: readable by all, insert by authenticated, update by creator
CREATE POLICY "Lobbies are viewable by everyone" ON lobbies
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create lobbies" ON lobbies
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update lobby" ON lobbies
  FOR UPDATE USING (auth.uid() = creator_id);

-- Lobby participants: readable by all, insert by authenticated
CREATE POLICY "Lobby participants are viewable by everyone" ON lobby_participants
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join lobbies" ON lobby_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave lobbies" ON lobby_participants
  FOR DELETE USING (auth.uid() = user_id);

-- Check-ins: readable by all, insert by authenticated, update own
CREATE POLICY "Check-ins are viewable by everyone" ON check_ins
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can check in" ON check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own check-ins" ON check_ins
  FOR UPDATE USING (auth.uid() = user_id);

-- Check-in cooldown: prevent re-check-in within 5 minutes on same court
CREATE OR REPLACE FUNCTION enforce_check_in_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM check_ins
    WHERE user_id = NEW.user_id
      AND court_id = NEW.court_id
      AND checked_in_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RAISE EXCEPTION 'Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_in_cooldown
BEFORE INSERT ON check_ins
FOR EACH ROW
EXECUTE FUNCTION enforce_check_in_cooldown();

-- Check-in distance validation (50m from court)
CREATE OR REPLACE FUNCTION enforce_check_in_distance()
RETURNS TRIGGER AS $$
DECLARE
  court_location GEOGRAPHY;
  user_location GEOGRAPHY;
  distance DOUBLE PRECISION;
BEGIN
  SELECT location INTO court_location FROM courts WHERE id = NEW.court_id;
  IF court_location IS NULL THEN
    RAISE EXCEPTION 'Campo non trovato';
  END IF;

  user_location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  distance := ST_Distance(court_location, user_location);

  IF distance > 50 THEN
    RAISE EXCEPTION 'Sei troppo lontano dal campo (%.0f m). Avvicinati per fare check-in.', distance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_in_distance
BEFORE INSERT ON check_ins
FOR EACH ROW
EXECUTE FUNCTION enforce_check_in_distance();

-- Increment karma (+1) on verified check-in
CREATE OR REPLACE FUNCTION increment_karma_on_check_in()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET karma_score = LEAST(karma_score + 1, 100)
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_karma
AFTER INSERT ON check_ins
FOR EACH ROW
EXECUTE FUNCTION increment_karma_on_check_in();

-- Decrement karma (-3) on missed check-in (lobby closed without check-in)
CREATE OR REPLACE FUNCTION decrement_karma_on_missed_check_in()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IN ('open', 'in_progress') THEN
    UPDATE profiles
    SET karma_score = karma_score - 3
    WHERE user_id IN (
      SELECT lp.user_id
      FROM lobby_participants lp
      WHERE lp.lobby_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.lobby_id = NEW.id
        )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_karma_on_close
AFTER UPDATE ON lobbies
FOR EACH ROW
WHEN (OLD.status IN ('open', 'in_progress') AND NEW.status = 'closed')
EXECUTE FUNCTION decrement_karma_on_missed_check_in();

-- Ban logic: karma < 50 -> ban for 7 days
CREATE OR REPLACE FUNCTION enforce_ban_on_low_karma()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.karma_score < 50 AND NEW.banned_until IS NULL THEN
    NEW.banned_until := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_ban
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_ban_on_low_karma();

-- Prevent banned users from joining/creating lobbies
CREATE OR REPLACE FUNCTION check_user_not_banned()
RETURNS TRIGGER AS $$
DECLARE
  user_banned_until TIMESTAMPTZ;
  user_karma INTEGER;
BEGIN
  SELECT banned_until, karma_score INTO user_banned_until, user_karma
  FROM profiles WHERE user_id = auth.uid();

  IF user_banned_until IS NOT NULL AND user_banned_until > NOW() THEN
    RAISE EXCEPTION 'Sei bannato fino a %', user_banned_until;
  END IF;

  IF user_karma < 50 THEN
    RAISE EXCEPTION 'Karma troppo basso (%). Non puoi partecipare.', user_karma;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_banned_on_join
BEFORE INSERT ON lobby_participants
FOR EACH ROW
EXECUTE FUNCTION check_user_not_banned();

CREATE TRIGGER trigger_check_banned_on_create
BEFORE INSERT ON lobbies
FOR EACH ROW
EXECUTE FUNCTION check_user_not_banned();

-- Push notifications table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subscription)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Function to send push notification (basic - requires Edge Function for actual delivery)
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO push_notifications (user_id, title, body, data, sent_at)
  VALUES (p_user_id, p_title, p_body, p_data, NOW());
END;
$$ LANGUAGE plpgsql;

-- Push notifications queue table
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON push_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Court reports: readable by all, insert by authenticated
CREATE POLICY "Court reports are viewable by everyone" ON court_reports
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reports" ON court_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
