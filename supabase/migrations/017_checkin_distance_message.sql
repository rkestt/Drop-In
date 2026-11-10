-- d21: il messaggio di enforce_check_in_distance usava `%.0f` in RAISE
-- EXCEPTION, ma RAISE supporta solo il placeholder `%` nudo: il `.0f`
-- restava letterale ("(1003.40670779.0f m)"). Ora i metri sono interi
-- ("(1003 m)"), come li mostra la UI ("Sei a N m dal campo").
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
    -- RAISE EXCEPTION capisce solo il placeholder `%` nudo: la
    -- formattazione vera passa da format().
    RAISE EXCEPTION '%', format('Sei troppo lontano dal campo (%s m). Avvicinati per fare check-in.', ROUND(distance)::INT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
