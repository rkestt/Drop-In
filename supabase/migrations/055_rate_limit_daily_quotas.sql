-- 055_rate_limit_daily_quotas.sql
-- Chiude #84 (seconda parte): le quote passano da orarie a giornaliere, con
-- i numeri fuori dal codice in `rate_limit_quotas`.
--
-- Perche' una tabella e non costanti nelle funzioni: alzare "3 lobby al
-- giorno" non deve richiedere una migration. `enforce_rate_limit` (034) legge
-- la soglia dalla tabella nella stessa transazione (gia' serializzata dal
-- lock consultivo); se la riga manca, usa il limite passato dal guard come
-- fallback, cosi' svuotare la tabella non rompe nulla.
--
-- Perche' 24 ore e non una finestra mobile diversa: e' la stessa semantica
-- "ultime N ore" della 034, solo piu' larga. I bucket degli eventi cambiano
-- nome (`report` -> `court_reports`, `review` -> `court_reviews`,
-- `check_in` -> `check_ins`) per parlare la stessa lingua delle tabelle; le
-- righe vecchie vengono rimappate, cosi' chi ha segnalato un'ora fa non
-- riparte da zero. La pulizia pg_cron a 7 giorni della 034 resta valida.
--
-- Bypass moderatori: stesso stile del bypass `auth.uid() IS NULL` in
-- 034:73-77 — `public.is_moderator()` (012, default = auth.uid()) dentro la
-- funzione DEFINER, come gia' fanno approve/reject (030/051). Chi cura i
-- campi non si blocca da solo; le azioni dei moderatori non lasciano eventi.
--
-- Le RPC con tetti letti dalle righe (`submit_court`, `resubmit_submission`,
-- `propose_court_name`) NON passano da enforce_rate_limit: qui si allarga
-- solo la finestra a 24 ore e si adegua la soglia, copiando l'ultimo corpo
-- noto (submit = 049 con beach_volleyball + address, resubmit = 030,
-- propose = 051). I grant restano: CREATE OR REPLACE non li tocca.
--
-- Soglie giornaliere (persone, non bot): submit 2, segnalazioni 10, lobby 3,
-- join 15, recensioni 5, check-in 10, proposte nome 5, resubmit 5.
-- Idempotente: IF NOT EXISTS / OR REPLACE / ON CONFLICT, ri-eseguibile.

-- ============================================================================
-- Quotas: una riga per bucket, modificabile senza migration.
-- RLS attiva e chiusa ai client, stesso contratto di rate_limit_events
-- (034:42-48): la legge solo enforce_rate_limit (SECURITY DEFINER).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_quotas (
  bucket TEXT PRIMARY KEY,
  max_per_day INTEGER NOT NULL CHECK (max_per_day > 0)
);

ALTER TABLE public.rate_limit_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_quotas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limit_quotas TO service_role;

INSERT INTO public.rate_limit_quotas (bucket, max_per_day) VALUES
  ('submit_court', 2),
  ('court_reports', 10),
  ('lobby', 3),
  ('lobby_join', 15),
  ('court_reviews', 5),
  ('check_ins', 10),
  ('propose_court_name', 5),
  ('resubmit', 5)
ON CONFLICT (bucket) DO UPDATE SET max_per_day = EXCLUDED.max_per_day;

-- I bucket 034 parlavano un'altra lingua (`report`, `review`, `check_in`):
-- rimappa le righe recenti invece di azzerare le finestre a deploy.
UPDATE public.rate_limit_events SET bucket = 'court_reports' WHERE bucket = 'report';
UPDATE public.rate_limit_events SET bucket = 'court_reviews' WHERE bucket = 'review';
UPDATE public.rate_limit_events SET bucket = 'check_ins' WHERE bucket = 'check_in';

-- ============================================================================
-- enforce_rate_limit: stessa firma della 034 (grant e database.types intatti),
-- ora quota giornaliera da tabella. `p_limit` resta il fallback quando la
-- riga quota manca; `p_window` resta per compatibilita' di firma ma la
-- finestra effettiva e' sempre 24 ore.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_bucket TEXT,
  p_limit INTEGER,
  p_window INTERVAL,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'Limite non valido per %', p_bucket;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Sessioni senza claim (psql, cron, service_role): niente da limitare.
    RETURN;
  END IF;

  -- I moderatori curano i campi: niente quota per loro (stesso stile del
  -- bypass NULL qui sopra; is_moderator() dalla 012, default = auth.uid()).
  IF public.is_moderator() THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rate_limit:' || p_bucket || ':' || v_uid::text));

  -- Quota giornaliera da tabella; riga mancante -> fallback al limite del
  -- guard (i default giornalieri qui sotto).
  SELECT max_per_day INTO v_limit
  FROM public.rate_limit_quotas
  WHERE bucket = p_bucket;
  IF v_limit IS NULL THEN
    v_limit := p_limit;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE bucket = p_bucket
    AND subject = v_uid
    AND created_at > now() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION '%', p_message USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limit_events (bucket, subject) VALUES (p_bucket, v_uid);
END;
$$;

-- Stessa firma: i REVOKE/GRANT della 034 restano validi, niente da ri-concedere.

-- ============================================================================
-- Guard: stessi trigger della 034, nuovi bucket + limiti giornalieri come
-- fallback + messaggi col nome dell'azione ("Riprova domani", niente retry).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_rate_limit_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'court_reports', 10, INTERVAL '24 hours',
    'Hai raggiunto il limite giornaliero di segnalazioni. Riprova domani.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_lobby()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'lobby', 3, INTERVAL '24 hours',
    'Hai raggiunto il limite giornaliero di lobby. Riprova domani.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_lobby_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'lobby_join', 15, INTERVAL '24 hours',
    'Hai raggiunto il limite giornaliero di partecipazioni. Riprova domani.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'court_reviews', 5, INTERVAL '24 hours',
    'Hai raggiunto il limite giornaliero di recensioni. Riprova domani.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_check_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'check_ins', 10, INTERVAL '24 hours',
    'Hai raggiunto il limite giornaliero di check-in. Riprova domani.');
  RETURN NEW;
END;
$$;

-- ============================================================================
-- submit_court: corpo della 049 (ultima definizione: beach_volleyball dalla
-- 049 + address dalla 031), finestra 1 ora -> 24 ore, tetto 1 -> 2/giorno.
-- ============================================================================
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
    AND created_at > now() - interval '24 hours';
  IF v_recent >= 2 THEN
    RAISE EXCEPTION 'Hai raggiunto il limite giornaliero di proposte di nuovi campi. Riprova domani.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.courts (name, lat, lng, surface_type, sport, location, source, submitted_by, moderation_status, status, photo_path, address)
  VALUES (v_name, p_lat, p_lng, p_surface, p_sport, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 'community', v_uid, 'pending', 'active', p_photo_path, v_address)
  RETURNING id INTO v_court_id;

  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, gps_accuracy, status)
  VALUES (v_court_id, v_uid, v_name, p_lat, p_lng, p_photo_path, p_gps_accuracy, 'pending');

  RETURN v_court_id;
END;
$$;

-- ============================================================================
-- resubmit_submission: corpo della 030 (unica definizione). Tetto 1
-- (1/corte/min) invariato; tetto 2: 5 pending/ora -> 5/giorno.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resubmit_submission(p_court_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_owner UUID;
  v_status TEXT;
  v_name TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_photo TEXT;
  v_recent_court INTEGER;
  v_recent_user INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT submitted_by, moderation_status, name, lat, lng, photo_path
  INTO v_owner, v_status, v_name, v_lat, v_lng, v_photo
  FROM public.courts WHERE id = p_court_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta inesistente.' USING ERRCODE = 'P0001';
  END IF;

  -- Riga altrui, senza proponente o non rifiutata: stesso diniego.
  IF v_owner IS DISTINCT FROM v_uid OR v_status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'Puoi riproporre solo una tua proposta rifiutata.' USING ERRCODE = 'P0001';
  END IF;

  -- Stesse invarianti di `submit_court` che la stored row deve rispettare
  -- (nome, lat/lng finiti). NaN passa i confronti di range in Postgres
  -- (NaN > 90 e' vero, NaN < -90 e' falso), quindi va escluso esplicito.
  IF v_lat IS NULL OR v_lng IS NULL
     OR v_lat != v_lat OR v_lng != v_lng
     OR v_lat < -90 OR v_lat > 90 THEN
    RAISE EXCEPTION 'Latitudine non valida.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lng < -180 OR v_lng > 180 THEN
    RAISE EXCEPTION 'Longitudine non valida.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name IS NOT NULL AND char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Il nome è troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  -- Serializza il check-then-insert per utente (stesso lock di submit_court).
  PERFORM pg_advisory_xact_lock(hashtext('resubmit_submission:' || v_uid::text));

  -- Tetto 1: max 1 resubmit per corte al minuto. La reject non crea righe,
  -- quindi si contano le pending recenti: dopo il primo resubmit ce n'e'
  -- esattamente una e un secondo invio entro il minuto viene negato.
  SELECT COUNT(*) INTO v_recent_court
  FROM public.court_submissions
  WHERE court_id = p_court_id
    AND status = 'pending'
    AND created_at > now() - interval '1 minute';
  IF v_recent_court >= 1 THEN
    RAISE EXCEPTION 'Hai gia riproposto questo campo. Attendi un minuto.' USING ERRCODE = 'P0001';
  END IF;

  -- Tetto 2: max 5 pending create nelle ultime 24 ore per utente (submit +
  -- resubmit: il resubmit e' una correzione, ma resta un invio in coda).
  SELECT COUNT(*) INTO v_recent_user
  FROM public.court_submissions
  WHERE submitter_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '24 hours';
  IF v_recent_user >= 5 THEN
    RAISE EXCEPTION 'Hai raggiunto il limite giornaliero di riproposizioni. Riprova domani.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.courts
  SET moderation_status = 'pending', duplicate_of = NULL
  WHERE id = p_court_id;

  -- Nuova riga di audit: la rejected resta come storia (moderation_note
  -- compresa), la coda di moderazione legge le pending.
  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, status, moderation_note)
  VALUES (p_court_id, v_uid, v_name, v_lat, v_lng, v_photo, 'pending', NULL);
END;
$$;

-- ============================================================================
-- propose_court_name: corpo della 051 (unica definizione). Tetto 1
-- (1/campo/min) invariato; tetto 2: 5 pending/ora -> 5/giorno.
-- (withdraw/approve/reject/close non hanno tetti: invariati.)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.propose_court_name(
  p_court_id UUID,
  p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_name TEXT;
  v_status TEXT;
  v_current TEXT;
  v_recent_court INTEGER;
  v_recent_user INTEGER;
  v_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  v_name := NULLIF(TRIM(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Inserisci un nome.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Il nome è troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  SELECT moderation_status, name INTO v_status, v_current
  FROM public.courts WHERE id = p_court_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campo inesistente.' USING ERRCODE = 'P0001';
  END IF;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Operazione consentita solo su campi approvati.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name = v_current THEN
    RAISE EXCEPTION 'Il nome proposto è uguale a quello attuale.' USING ERRCODE = 'P0001';
  END IF;

  -- Stesso lock di submit_court/resubmit: serializza il check-then-insert.
  PERFORM pg_advisory_xact_lock(hashtext('propose_court_name:' || v_uid::text));

  IF EXISTS (SELECT 1 FROM public.court_name_proposals
             WHERE court_id = p_court_id AND proposer_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'Hai già una proposta in attesa per questo campo.' USING ERRCODE = 'P0001';
  END IF;

  -- Tetto 1: max 1 proposta pending per campo al minuto (doppio click, retry).
  SELECT COUNT(*) INTO v_recent_court
  FROM public.court_name_proposals
  WHERE court_id = p_court_id
    AND proposer_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '1 minute';
  IF v_recent_court >= 1 THEN
    RAISE EXCEPTION 'Hai appena proposto un nome per questo campo. Attendi un minuto.' USING ERRCODE = 'P0001';
  END IF;

  -- Tetto 2: max 5 proposte pending create nelle ultime 24 ore per utente.
  SELECT COUNT(*) INTO v_recent_user
  FROM public.court_name_proposals
  WHERE proposer_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '24 hours';
  IF v_recent_user >= 5 THEN
    RAISE EXCEPTION 'Hai raggiunto il limite giornaliero di proposte di nome. Riprova domani.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.court_name_proposals (court_id, proposer_id, proposed_name)
  VALUES (p_court_id, v_uid, v_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
