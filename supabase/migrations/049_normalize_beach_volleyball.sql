-- 049_normalize_beach_volleyball.sql
-- Decisione prodotto: il beach volley e' un filtro suo ("Beach volley"), non
-- dentro "Pallavolo". Lo slug OSM `beachvolleyball` (senza underscore) diventa
-- il canonico `beach_volleyball`, in linea con `lib/sport/sports.ts`.
--
-- Dati: in locale esiste solo `sport = 'beachvolleyball'` puro (nessun
-- multi-sport con beach); il REPLACE copre comunque anche i valori composti
-- con separatore `;` senza toccare gli altri slug (`beachvolleyball` non e'
-- sottostringa di nessun altro slug in uso: `volleyball` non lo contiene).
-- Allowlist RPC: `submit_court` (031) e `update_pending_submission` (026)
-- rifiuterebbero il nuovo slug — CREATE OR REPLACE con corpo invariato a
-- parte la lista (stessa firma: i grant restano, niente REVOKE/GRANT).

UPDATE public.courts
SET sport = REPLACE(sport, 'beachvolleyball', 'beach_volleyball')
WHERE sport LIKE '%beachvolleyball%';

CREATE OR REPLACE FUNCTION public.submit_court(
  p_name TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_sport TEXT DEFAULT NULL,
  p_surface TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL,
  p_gps_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_name TEXT;
  v_address TEXT;
  v_recent INTEGER;
  v_court_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Devi essere autenticato per inviare un campo.' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Il nome è troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  IF p_sport IS NOT NULL AND p_sport NOT IN ('basketball','soccer','tennis','volleyball','beach_volleyball','padel','futsal','multi','altro') THEN
    RAISE EXCEPTION 'Sport non valido.' USING ERRCODE = 'P0001';
  END IF;

  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;

  -- Come la 012: il LIKE sopra non basta (uid/../../x lo passa).
  IF p_photo_path IS NOT NULL AND (
    p_photo_path LIKE '/%'
    OR position('..' IN p_photo_path) > 0
    OR position('\' IN p_photo_path) > 0
    OR p_photo_path ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;

  -- #75: indirizzo umano opzionale (proposta senza essere sul posto).
  -- Trim + stringa vuota/blank -> NULL; max 200 caratteri; niente caratteri
  -- di controllo o a-capo (la regex semplice basta: i newline non sono
  -- stampabili, il controllo esplicito su \n/\r inchioda l'intento).
  v_address := NULLIF(TRIM(COALESCE(p_address, '')), '');
  IF v_address IS NOT NULL THEN
    IF char_length(v_address) > 200 THEN
      RAISE EXCEPTION 'Indirizzo troppo lungo (max 200 caratteri).' USING ERRCODE = 'P0001';
    END IF;
    IF v_address !~ '^[[:print:]]+$' OR v_address ~ '[\n\r]' THEN
      RAISE EXCEPTION 'Indirizzo non valido.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Serializza il check-then-insert per utente (lock di transazione,
  -- rilasciato automaticamente a fine transazione), come la 012.
  PERFORM pg_advisory_xact_lock(hashtext('submit_court:' || v_uid::text));

  SELECT COUNT(*) INTO v_recent
  FROM public.court_submissions
  WHERE submitter_id = v_uid
    AND created_at > now() - interval '1 hour';
  IF v_recent >= 1 THEN
    RAISE EXCEPTION 'Hai gia inviato un campo nell ultima ora. Riprova piu tardi.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.courts (name, lat, lng, surface_type, sport, location, source, submitted_by, moderation_status, status, photo_path, address)
  VALUES (v_name, p_lat, p_lng, p_surface, p_sport, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 'community', v_uid, 'pending', 'active', p_photo_path, v_address)
  RETURNING id INTO v_court_id;

  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, gps_accuracy, status)
  VALUES (v_court_id, v_uid, v_name, p_lat, p_lng, p_photo_path, p_gps_accuracy, 'pending');

  RETURN v_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pending_submission(
  p_court_id UUID,
  p_name TEXT,
  p_sport TEXT DEFAULT NULL,
  p_surface TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_owner UUID;
  v_status TEXT;
  v_existing_photo TEXT;
  v_name TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT submitted_by, moderation_status, photo_path
  INTO v_owner, v_status, v_existing_photo
  FROM public.courts WHERE id = p_court_id;

  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Solo le proposte in attesa si possono modificare.' USING ERRCODE = '42501';
  END IF;

  v_name := NULLIF(TRIM(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    IF p_photo_path IS NULL AND v_existing_photo IS NULL THEN
      RAISE EXCEPTION 'Inserisci un nome o una foto.' USING ERRCODE = 'P0001';
    END IF;
    v_name := 'Campo senza nome';
  END IF;
  IF char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Il nome e troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  IF p_sport IS NOT NULL AND p_sport NOT IN ('basketball','soccer','tennis','volleyball','beach_volleyball','padel','futsal','multi','altro') THEN
    RAISE EXCEPTION 'Sport non valido.' USING ERRCODE = 'P0001';
  END IF;

  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;
  IF p_photo_path IS NOT NULL AND (
    p_photo_path LIKE '/%'
    OR position('..' IN p_photo_path) > 0
    OR position('\' IN p_photo_path) > 0
    OR p_photo_path ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION 'Percorso foto non valido.' USING ERRCODE = 'P0001';
  END IF;

  -- p_photo_path NULL = nessuna nuova foto, resta quella esistente; NULL
  -- esplicito non azzera mai il riferimento (la rimozione foto non e' esposta).
  UPDATE public.courts
  SET name = v_name,
      sport = p_sport,
      surface_type = p_surface,
      photo_path = COALESCE(p_photo_path, photo_path)
  WHERE id = p_court_id;

  UPDATE public.court_submissions
  SET raw_name = v_name,
      photo_path = COALESCE(p_photo_path, photo_path)
  WHERE court_id = p_court_id;
END;
$$;
