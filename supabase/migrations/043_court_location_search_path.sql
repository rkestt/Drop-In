-- 043_court_location_search_path.sql
-- Chiude #94 (Lane B): `auth.admin.deleteUser` gira come
-- `supabase_auth_admin`, il cui search_path e' solo `auth`. La cascata
-- tocca `courts` (`submitted_by` SET NULL) e `trigger_update_court_location`
-- risolveva `geography`/`ST_MakePoint` nello search_path del chiamante:
-- `type "geography" does not exist`, delete sempre 500 via API mentre il
-- DELETE diretto come postgres funzionava. La funzione ora pinna il
-- proprio search_path (stesso pattern delle DEFINER del repo: 002, 027,
-- 037-040); corpo invariato dalla 001. Audit Lane B: e' l'unica funzione
-- della cascata senza path pinnato — `require_approved_court` e' DEFINER
-- con path, gli altri trigger toccati sono INSERT-only, column-specific
-- (`UPDATE OF court_id`/`name, address`) o usano solo NEW/NOW().

CREATE OR REPLACE FUNCTION public.update_court_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$;
