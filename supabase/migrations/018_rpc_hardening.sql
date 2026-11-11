-- 018_rpc_hardening.sql
-- Chiude #54, #59 e #61 senza toccare le migration precedenti.
-- Idempotente nello stile del progetto: CREATE OR REPLACE (stessa firma,
-- i GRANT della 012 restano validi); DROP + re-GRANT solo dove cambia il
-- tipo di ritorno (#61).

-- ============================================================================
-- #54. dedup_candidates: maschera TUTTE le colonne sensibili delle pending altrui.
-- Prima: solo id e name erano mascherati (012:182-195); lat/lng/distance_m
-- restavano in chiaro e rivelavano DOVE si trova la proposta altrui, e
-- moderation_status/source confermavano che e' una pending. Ora lo stesso
-- predicato CASE...THEN NULL copre lat, lng, distance_m, moderation_status e
-- source. Le righe approved e le proprie restano intatte.
-- ============================================================================
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
  SELECT
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE c.id
    END,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN 'Proposta in attesa'
      ELSE c.name
    END,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE c.lat
    END,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE c.lng
    END,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE ST_Distance(c.location, o.g)
    END AS distance_m,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE c.moderation_status
    END,
    CASE
      WHEN c.moderation_status <> 'approved' AND c.submitted_by IS DISTINCT FROM auth.uid()
      THEN NULL
      ELSE c.source
    END
  FROM public.courts c, origin o
  WHERE c.location IS NOT NULL
    AND ST_DWithin(c.location, o.g, p_radius_m)
    AND c.moderation_status IN ('approved','pending')
  ORDER BY c.location <-> o.g;
$$;

-- ============================================================================
-- #59. Guardie di moderazione NULL-opache -> deny di default.
-- Prima: `auth.role() <> 'service_role'` con claim assenti (psql/Studio come
-- postgres, futuri job pg_cron) valeva NULL, l'IF non scattava e la guardia
-- lasciava passare. Ora `IS DISTINCT FROM`: un auth.role() NULL nega invece
-- di aprire. Corpi invariati, firme invariate -> OR REPLACE, GRANT intatti.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_court(p_court_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.courts
  SET moderation_status = 'approved', duplicate_of = NULL
  WHERE id = p_court_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Corte inesistente: %', p_court_id USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.court_submissions
  SET status = 'approved', moderation_note = p_note
  WHERE court_id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_court(p_court_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.courts SET moderation_status = 'rejected' WHERE id = p_court_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Corte inesistente: %', p_court_id USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.court_submissions SET status = 'rejected', moderation_note = p_note WHERE court_id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_duplicate(p_court_id UUID, p_duplicate_of UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
  v_target_status TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  IF p_court_id = p_duplicate_of THEN
    RAISE EXCEPTION 'Una corte non puo essere duplicato di se stessa.' USING ERRCODE = 'P0001';
  END IF;
  SELECT c.moderation_status INTO v_target_status
  FROM public.courts c WHERE c.id = p_duplicate_of;
  IF v_target_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'La corte target deve esistere ed essere approvata.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.courts SET moderation_status = 'duplicate', duplicate_of = p_duplicate_of WHERE id = p_court_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Corte inesistente: %', p_court_id USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.court_submissions SET status = 'duplicate' WHERE court_id = p_court_id;
END;
$$;

-- ============================================================================
-- #61. courts_in_viewport: colonne esplicite invece di SETOF courts.
-- Prima: RETURNS SETOF public.courts con SELECT * esponeva tutto (osm_id,
-- submitted_by, duplicate_of, created_at, updated_at, location) e qualunque
-- futura colonna sensibile finirebbe in PostgREST senza revisione. Ora il
-- RETURN TABLE elenca esattamente cio' che legge l'app (interfaccia Court in
-- app/(app)/page.tsx:75-89; la colonna DB e' photo_path, rinominata dalla
-- 011, mentre photo_url resta solo un nome stale nell'interfaccia TS).
-- Comportamento invariato: stesso WHERE, stesso LIMIT, nessun ORDER BY,
-- SECURITY INVOKER (la RLS resta l'unico filtro di lettura).
-- Il cambio di tipo di ritorno richiede DROP: si ricreano i GRANT della 012.
-- ============================================================================
DROP FUNCTION IF EXISTS public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT);

CREATE FUNCTION public.courts_in_viewport(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_results INTEGER DEFAULT 2000,
  p_sport TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, surface_type TEXT, hoop_count INTEGER,
  status TEXT, sport TEXT, venue_type TEXT,
  source TEXT, photo_path TEXT, moderation_status TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.status, c.sport, c.venue_type, c.source, c.photo_path, c.moderation_status
  FROM public.courts c
  WHERE c.status = 'active'
    AND c.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    AND (p_sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
  LIMIT max_results;
$$;

REVOKE ALL ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) TO anon, authenticated;
