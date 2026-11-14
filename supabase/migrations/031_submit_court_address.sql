-- 031_submit_court_address.sql
-- Chiude #75 (lane DB): `submit_court` accetta un indirizzo umano opzionale
-- (`p_address`), per le proposte inserite senza essere sul posto (pin su
-- mappa / indirizzo / coordinate). La UI che segue possiede il campo; qui
-- solo il layer DB: validazione, salvataggio in `courts.address` (colonna
-- esistente dalla 001), grant e regressioni RLS.
--
-- Perche' DROP + CREATE invece di OR REPLACE: aggiungere un parametro crea
-- un overload, non sostituisce la firma (trappola nota in docs/rpc.md:
-- ogni DROP azzera i grant, quindi si ri-concedono nello stesso file,
-- modello 012 punto 10 e 026).
-- `resubmit_submission` (030) non cambia firma: tocca solo
-- moderation_status/duplicate_of, quindi l'address della riga resta intatto
-- per costruzione — nessuna patch necessaria, solo la regressione 42 che
-- lo inchioda.
--
-- Due classi di errore come in 026/030: 42501 = diniego di autorizzazione,
-- P0001 = validazione applicativa (messaggi in italiano per la UI).
-- Idempotente: DROP IF EXISTS + CREATE OR REPLACE + REVOKE/GRANT.

-- Aggiungere il parametro crea un overload: si rimuove la vecchia firma a
-- 7 argomenti (copia del corpo dalla 012, con il lock anti-flood e la
-- validazione del photo_path invariati).
DROP FUNCTION IF EXISTS public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION);

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

  IF p_sport IS NOT NULL AND p_sport NOT IN ('basketball','soccer','tennis','volleyball','padel','futsal','multi','altro') THEN
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

-- Stesso modello della 012 punto 10 e della 026: revoca totale (PUBLIC
-- incluso, per i grant impliciti del boot di Supabase) e concessione ai
-- soli ruoli voluti. Convenzione esistente di submit_court (010/011/012):
-- solo authenticated, niente service_role.
REVOKE ALL ON FUNCTION public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_court(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, TEXT) TO authenticated;
