-- 048_pin_search_path_triggers.sql
-- Chiude il KNOWN_DEBT di #102 (gate `npm run check:search-path`): le 4
-- funzioni trigger sotto risolvevano tabelle/funzioni nello search_path del
-- chiamante (`FROM profiles`/`check_ins`/`courts`, `ST_*`, `UPDATE profiles`).
-- Oggi sono INSERT/UPDATE-only, quindi la cascata di `auth.admin.deleteUser`
-- (search_path solo `auth`) non le tocca — ma restano fragili a qualunque
-- chiamata con search_path ostile, stesso pattern del bug 043.
-- Corpi invariati (001 per tre, 017 per `enforce_check_in_distance`);
-- aggiunge solo il pin. Nessuna SECURITY DEFINER (non c'era), VOLATILE
-- invariato. `enforce_check_in_distance` usa `ST_*`: PostGIS in locale e'
-- nello schema `public`, su Cloud in `extensions` — il pin `public,
-- extensions` copre entrambi (stesso pattern della 043).

CREATE OR REPLACE FUNCTION public.check_user_not_banned()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.enforce_check_in_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.enforce_check_in_distance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
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
    -- RAISE EXCEPTION capisce solo il placeholder `%` nudo: la
    -- formattazione vera passa da format().
    RAISE EXCEPTION '%', format('Sei troppo lontano dal campo (%s m). Avvicinati per fare check-in.', ROUND(distance)::INT);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_karma_on_check_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET karma_score = LEAST(karma_score + 1, 100)
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
