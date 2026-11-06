-- 012_moderation_hardening.sql
-- Indurimento del layer DB dopo security review. Estende 010/011 senza modificarle.
-- Nota: la migration gira come postgres senza JWT claims. Nessuna istruzione qui
-- sotto scrive su public.profiles, quindi il guard riscritto al punto 5 non scatta
-- in migrazione.

-- ============================================================================
-- Punto 5. guard_profile_moderator: default-deny + copertura BEFORE INSERT
-- Prima: qualunque sessione senza claim JWT passava (role_claim NULL saltava il
-- controllo) e solo gli UPDATE erano coperti.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_moderator()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
  v_protected BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Su INSERT non esiste OLD: l'unica escalation possibile e' creare una riga
    -- gia' moderatore. Le insert legittime (handle_new_user, default false) passano.
    v_protected := COALESCE(NEW.is_moderator, false);
  ELSE
    v_protected := (NEW.is_moderator IS DISTINCT FROM OLD.is_moderator);
  END IF;
  IF v_protected THEN
    v_role := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
    IF v_role IS DISTINCT FROM 'service_role' THEN
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

DROP TRIGGER IF EXISTS guard_profile_moderator_insert ON public.profiles;
CREATE TRIGGER guard_profile_moderator_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_moderator();

-- ============================================================================
-- Punto 4. is_moderator(p_uid): chiude l'oracolo per anon.
-- Prima: p_uid <> auth.uid() con auth.uid() NULL valeva NULL, l'IF non scattava
-- e un anonimo poteva enumerare i moderatori. Ora il default e' deny.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_moderator(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_uid IS DISTINCT FROM auth.uid() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT bool_or(is_moderator) FROM public.profiles WHERE user_id = p_uid), false);
END;
$$;

-- ============================================================================
-- Punti 1+2. submit_court: lock anti-flood + validazione percorso foto.
-- Corpo copiato dalla 011, con due sole aggiunte:
--  1. pg_advisory_xact_lock prima del COUNT (dieci chiamate parallele creavano
--     dieci corti: COUNT poi INSERT senza lock non e' atomico).
--  2. rifiuto dei photo_path con '..', backslash, caratteri di controllo o
--     leading '/' (uid/../../x passava sia il LIKE che la policy storage).
-- ============================================================================
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

  -- Punto 2: il LIKE sopra non basta (uid/../../x lo passa).
  IF p_photo_path IS NOT NULL AND (
    p_photo_path LIKE '/%'
    OR position('..' IN p_photo_path) > 0
    OR position('\' IN p_photo_path) > 0
    OR p_photo_path ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;

  -- Punto 1: serializza il check-then-insert per utente (lock di transazione,
  -- rilasciato automaticamente a fine transazione).
  PERFORM pg_advisory_xact_lock(hashtext('submit_court:' || v_uid::text));

  SELECT COUNT(*) INTO v_recent
  FROM public.court_submissions
  WHERE submitter_id = v_uid
    AND created_at > now() - interval '1 hour';
  IF v_recent >= 1 THEN
    RAISE EXCEPTION 'Hai gia inviato un campo nell ultima ora. Riprova piu tardi.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.courts (name, lat, lng, surface_type, sport, location, source, submitted_by, moderation_status, status, photo_path)
  VALUES (v_name, p_lat, p_lng, p_surface, p_sport, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 'community', v_uid, 'pending', 'active', p_photo_path)
  RETURNING id INTO v_court_id;

  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, gps_accuracy, status)
  VALUES (v_court_id, v_uid, v_name, p_lat, p_lng, p_photo_path, p_gps_accuracy, 'pending');

  RETURN v_court_id;
END;
$$;

-- ============================================================================
-- Punto 3. dedup_candidates: maschera le pending altrui.
-- Prima: nome e coordinate di ogni proposta pending visibili a qualunque
-- authenticated (flood di pending -> enumerazione -> lobby su corti nascoste).
-- Ora: le righe non-approved di altri utenti espongono id NULL e nome
-- 'Proposta in attesa'. Le approved e le proprie restano intatte.
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
    c.lat, c.lng,
    ST_Distance(c.location, o.g) AS distance_m,
    c.moderation_status, c.source
  FROM public.courts c, origin o
  WHERE c.location IS NOT NULL
    AND ST_DWithin(c.location, o.g, p_radius_m)
    AND c.moderation_status IN ('approved','pending')
  ORDER BY c.location <-> o.g;
$$;

-- ============================================================================
-- Punto 6. RPC di moderazione: verifiche reali.
-- - approve/reject/mark_duplicate su uuid inesistente: ROW_COUNT + RAISE (prima
--   "riuscivano" in silenzio).
-- - mark_duplicate: niente self-duplicato, target deve esistere ed essere approved.
-- - approve: azzera duplicate_of + accetta p_note simmetrica a reject.
-- Nota: approve cambia firma -> DROP prima per non creare un overload.
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_court(UUID);

CREATE OR REPLACE FUNCTION public.approve_court(p_court_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
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
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
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
  IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
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

-- Punto 10 (amend). I GRANT della 010 non bastano: le funzioni avevano
-- EXECUTE a PUBLIC (=X in proacl) e grant espliciti ad anon applicati dal boot
-- di Supabase, quindi anon chiamava gia' dedup_candidates ed enumerava le
-- pending. Revoca totale (PUBLIC + anon + authenticated) e concedi solo ai
-- ruoli voluti. Verifica: nessun '=X' in proacl, anon assente dove non voluto.
REVOKE ALL ON FUNCTION public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dedup_candidates(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_court(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_court(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_duplicate(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_moderator(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dedup_candidates(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_court(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_court(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_duplicate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.courts_in_viewport(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_courts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator(UUID) TO anon, authenticated;

-- ============================================================================
-- Punto 7. Lobby e check-in solo su corti approved.
-- Prima: conoscendo l'UUID di una pending/rejected si creavano lobby (visibili
-- a tutti) e check-in sopra, filtrando l'esistenza della corte nascosta ad anon.
-- I trigger esistenti (ban su lobbies; cooldown e distanza su check_ins) restano.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.require_approved_court()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT c.moderation_status INTO v_status
  FROM public.courts c WHERE c.id = NEW.court_id;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Operazione consentita solo su campi approvati.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_approved_court_lobbies ON public.lobbies;
CREATE TRIGGER require_approved_court_lobbies
  BEFORE INSERT ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.require_approved_court();

DROP TRIGGER IF EXISTS require_approved_court_check_ins ON public.check_ins;
CREATE TRIGGER require_approved_court_check_ins
  BEFORE INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.require_approved_court();

-- ============================================================================
-- Punto 8. Filtro sport: trim dei token anche in SQL + normalizzazione dati.
-- Prima: 'basketball; volleyball' visibile nelle lobby, invisibile sulla mappa
-- (il client fa trim, string_to_array no). Firme invariate -> OR REPLACE, nessun
-- overload.
-- ============================================================================
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
    AND (p_sport IS NULL OR sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(courts.sport, ';')) t WHERE trim(t) = p_sport))
  LIMIT max_results;
$$;

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
    AND (p_sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    AND (p_query IS NULL OR c.name ILIKE '%' || p_query || '%')
  ORDER BY c.location <-> o.g
  LIMIT p_limit;
$$;

UPDATE public.courts
SET sport = regexp_replace(sport, '\s*;\s*', ';', 'g')
WHERE sport LIKE '%; %';
