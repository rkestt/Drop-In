-- Court submissions + moderation foundation (Phase 1 Lane 0)

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 2. courts new columns
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm',
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected','duplicate')),
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.courts(id) ON DELETE SET NULL;

-- 3. court_submissions
CREATE TABLE IF NOT EXISTS public.court_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE,
  submitter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  photo_path TEXT,
  gps_accuracy DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','duplicate')),
  moderation_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. profiles.is_moderator + guard trigger
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_moderator()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  role_claim TEXT;
BEGIN
  IF NEW.is_moderator IS DISTINCT FROM OLD.is_moderator THEN
    role_claim := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
    IF role_claim IS NOT NULL AND role_claim <> 'service_role' THEN
      RAISE EXCEPTION 'Non autorizzato a modificare is_moderator' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_moderator ON public.profiles;
CREATE TRIGGER guard_profile_moderator
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_moderator();

-- 5. helper
CREATE OR REPLACE FUNCTION public.is_moderator(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_uid IS NOT NULL AND p_uid <> auth.uid() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT bool_or(is_moderator) FROM public.profiles WHERE user_id = p_uid), false);
END;
$$;

-- 6. backfill
UPDATE public.courts
SET source = 'osm', moderation_status = 'approved'
WHERE source IS NULL OR moderation_status IS NULL;

-- keep NULL as "generic space, no declared sport" (visible only with p_sport IS NULL)

-- 7. RLS
DROP POLICY IF EXISTS courts_select_all ON public.courts;
DROP POLICY IF EXISTS "Courts are viewable by everyone" ON public.courts;
CREATE POLICY courts_select_all ON public.courts
  FOR SELECT
  USING (moderation_status = 'approved' OR submitted_by = auth.uid() OR public.is_moderator());

ALTER TABLE public.court_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS court_submissions_select ON public.court_submissions;
CREATE POLICY court_submissions_select ON public.court_submissions
  FOR SELECT
  USING (submitter_id = auth.uid() OR public.is_moderator());

REVOKE INSERT, UPDATE, DELETE ON public.courts, public.court_submissions FROM authenticated, anon;
GRANT ALL ON public.courts, public.court_submissions TO service_role;

-- 8. indexes
CREATE INDEX IF NOT EXISTS idx_courts_moderation_status ON public.courts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_courts_source ON public.courts(source);
CREATE INDEX IF NOT EXISTS idx_courts_name_trgm ON public.courts USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_court_submissions_submitter_created ON public.court_submissions(submitter_id, created_at DESC);

-- 9. storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('court-photos', 'court-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS court_photos_select ON storage.objects;
CREATE POLICY court_photos_select ON storage.objects
  FOR SELECT USING (bucket_id = 'court-photos');

DROP POLICY IF EXISTS court_photos_insert ON storage.objects;
CREATE POLICY court_photos_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'court-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS court_photos_update ON storage.objects;
CREATE POLICY court_photos_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'court-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS court_photos_delete ON storage.objects;
CREATE POLICY court_photos_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'court-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 10. submit_court
CREATE OR REPLACE FUNCTION public.submit_court(
  p_name TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_sport TEXT DEFAULT NULL,
  p_surface TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL,
  p_gps_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_name TEXT;
  v_recent INTEGER;
  v_court_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Devi essere autenticato per inviare un campo.' USING ERRCODE = 'P0001';
  END IF;

  IF p_lat < -90 OR p_lat > 90 THEN
    RAISE EXCEPTION 'Latitudine non valida.' USING ERRCODE = 'P0001';
  END IF;
  IF p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Longitudine non valida.' USING ERRCODE = 'P0001';
  END IF;

  v_name := NULLIF(TRIM(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    IF p_photo_path IS NULL THEN
      RAISE EXCEPTION 'Inserisci un nome o una foto.' USING ERRCODE = 'P0001';
    END IF;
    v_name := 'Campo senza nome';
  END IF;
  IF char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Il nome e troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  IF p_sport IS NOT NULL AND p_sport NOT IN ('basketball','soccer','tennis','volleyball','padel','futsal','multi','altro') THEN
    RAISE EXCEPTION 'Sport non valido.' USING ERRCODE = 'P0001';
  END IF;

  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_recent
  FROM public.court_submissions
  WHERE submitter_id = v_uid
    AND created_at > now() - interval '1 hour';
  IF v_recent >= 1 THEN
    RAISE EXCEPTION 'Hai gia inviato un campo nell ultima ora. Riprova piu tardi.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.courts (name, lat, lng, surface_type, sport, location, source, submitted_by, moderation_status, status, photo_url)
  VALUES (v_name, p_lat, p_lng, p_surface, p_sport, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 'community', v_uid, 'pending', 'active', NULL)
  RETURNING id INTO v_court_id;

  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, gps_accuracy, status)
  VALUES (v_court_id, v_uid, v_name, p_lat, p_lng, p_photo_path, p_gps_accuracy, 'pending');

  RETURN v_court_id;
END;
$$;

-- 11. dedup_candidates
CREATE OR REPLACE FUNCTION public.dedup_candidates(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 100
)
RETURNS TABLE (
  id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  distance_m DOUBLE PRECISION, moderation_status TEXT, source TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT c.id, c.name, c.lat, c.lng,
         ST_Distance(c.location, o.g) AS distance_m,
         c.moderation_status, c.source
  FROM public.courts c, origin o
  WHERE c.location IS NOT NULL
    AND ST_DWithin(c.location, o.g, p_radius_m)
    AND c.moderation_status IN ('approved','pending')
  ORDER BY c.location <-> o.g;
$$;

-- 12. moderation RPCs
CREATE OR REPLACE FUNCTION public.approve_court(p_court_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.courts SET moderation_status = 'approved' WHERE id = p_court_id;
  UPDATE public.court_submissions SET status = 'approved' WHERE court_id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_court(p_court_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.courts SET moderation_status = 'rejected' WHERE id = p_court_id;
  UPDATE public.court_submissions SET status = 'rejected', moderation_note = p_note WHERE court_id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_duplicate(p_court_id UUID, p_duplicate_of UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.courts SET moderation_status = 'duplicate', duplicate_of = p_duplicate_of WHERE id = p_court_id;
  UPDATE public.court_submissions SET status = 'duplicate' WHERE court_id = p_court_id;
END;
$$;

-- 13. extend read RPCs (drop old signatures first)
DROP FUNCTION IF EXISTS public.courts_in_viewport(double precision, double precision, double precision, double precision, integer);
CREATE OR REPLACE FUNCTION public.courts_in_viewport(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_results INTEGER DEFAULT 2000,
  p_sport TEXT DEFAULT NULL
)
RETURNS SETOF public.courts
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.courts
  WHERE status = 'active'
    AND location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    AND (p_sport IS NULL OR sport = 'multi' OR p_sport = ANY(string_to_array(sport, ';')))
  LIMIT max_results;
$$;

DROP FUNCTION IF EXISTS public.nearby_courts(double precision, double precision, double precision, integer);
CREATE OR REPLACE FUNCTION public.nearby_courts(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 15000,
  p_limit INTEGER DEFAULT 200,
  p_sport TEXT DEFAULT NULL,
  p_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, surface_type TEXT, hoop_count INTEGER,
  venue_type TEXT, sport TEXT, status TEXT, distance_m DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.venue_type, c.sport, c.status,
         ST_Distance(c.location, o.g) AS distance_m
  FROM public.courts c, origin o
  WHERE COALESCE(c.status, 'active') = 'active'
    AND ST_DWithin(c.location, o.g, p_radius_m)
    AND (p_sport IS NULL OR c.sport = 'multi' OR p_sport = ANY(string_to_array(c.sport, ';')))
    AND (p_query IS NULL OR c.name ILIKE '%' || p_query || '%')
  ORDER BY c.location <-> o.g
  LIMIT p_limit;
$$;

-- grants
GRANT EXECUTE ON FUNCTION public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dedup_candidates(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_court(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_court(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_duplicate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator(UUID) TO anon, authenticated;
