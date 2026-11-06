\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','a@test.local'),
  ('22222222-2222-2222-2222-222222222222','b@test.local');
INSERT INTO public.profiles (user_id, is_moderator) VALUES
  ('11111111-1111-1111-1111-111111111111', false),
  ('22222222-2222-2222-2222-222222222222', true);

INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Pending Court', 41.9, 12.5, ST_SetSRID(ST_MakePoint(12.5,41.9),4326)::geography, 'community',
        '11111111-1111-1111-1111-111111111111','pending','active');

-- a. anon cannot see pending
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts WHERE moderation_status='pending') THEN
    RAISE EXCEPTION 'anon saw pending court via table';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts_in_viewport(12.0,41.0,13.0,42.0) WHERE name='Pending Court') THEN
    RAISE EXCEPTION 'anon saw pending court via viewport';
  END IF;
END $$;
RESET ROLE;

-- b. non-mod cannot approve
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_court((SELECT id FROM public.courts WHERE moderation_status='pending' LIMIT 1));
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'non-mod approved court';
END $$;
RESET ROLE;

-- c. cannot self-promote
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET is_moderator = true WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'self-promotion succeeded';
END $$;
RESET ROLE;

-- d. cannot insert courts directly
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.courts (name, lat, lng, location) VALUES ('X',1.0,1.0,ST_SetSRID(ST_MakePoint(1.0,1.0),4326)::geography);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'direct insert succeeded';
END $$;
RESET ROLE;

-- e. submit twice fails second
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.submit_court('Test Court', 41.91, 12.51);
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Test Court 2', 41.92, 12.52);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'second submit succeeded';
END $$;
RESET ROLE;

-- f. dedup finds pending
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 200)) THEN
    RAISE EXCEPTION 'dedup_candidates empty';
  END IF;
END $$;
RESET ROLE;

-- positive: submit returns uuid
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE v UUID;
BEGIN
  v := public.submit_court('Mod Court', 41.93, 12.53);
  IF v IS NULL THEN RAISE EXCEPTION 'submit returned null'; END IF;
END $$;
RESET ROLE;

-- positive: moderator approves
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_court((SELECT id FROM public.courts WHERE name='Mod Court'));
RESET ROLE;

-- anon sees approved court
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name='Mod Court') THEN
    RAISE EXCEPTION 'anon cannot see approved court via table';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courts_in_viewport(12.52,41.92,12.54,41.94) WHERE name='Mod Court') THEN
    RAISE EXCEPTION 'anon cannot see approved court via viewport';
  END IF;
END $$;
RESET ROLE;

-- anon can call RPCs
SET LOCAL ROLE anon;
SELECT count(*) FROM public.courts_in_viewport(12.0,41.0,13.0,42.0);
SELECT count(*) FROM public.nearby_courts(41.9,12.5,5000,10);
RESET ROLE;

ROLLBACK;
