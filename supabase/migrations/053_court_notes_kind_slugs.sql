-- 053_court_notes_kind_slugs.sql
-- Allinea `court_notes` alla spec di design approvata (`docs/design/specs/note-campo.md`,
-- tabella dei tipi + decisione 9): gli slug dei `kind` passano all'inglese e il
-- tetto del `body` scende a 200.
--
-- Convenzione del repo: valori di dato in inglese, etichette italiane in app
-- (come `beach_volleyball` -> "Beach volley"); la mappatura slug -> etichetta
-- vive nella spec, non nel DB. Il vecchio CHECK italiano della 052 non deve
-- sopravvivere accanto al nuovo: DROP + ADD, non un secondo vincolo.
--
-- Mappatura 1:1 (rinomina pura, nessun accorpamento):
--   canestro_rotto -> broken_hoop   chiuso -> closed
--   area_privata  -> private_area    illuminazione -> no_lighting
--   superficie    -> surface         altro -> other
--
-- La tabella e' vuota in ogni ambiente (lane A appena atterrata, nessuna UI
-- di scrittura ancora): l'UPDATE qui sotto e' difensivo, per il caso in cui
-- una riga esista gia' (dev/stage/prod futuri o seed locali).
--
-- `body`: tetto 500 -> 200 (la UI ha il contatore a 200, spec decisione 10).
-- Stesse regole della 052 piu' la decisione 9 della spec: opzionale, blank ->
-- NULL, ma obbligatorio solo per `other` (una nota "Altro" senza testo non
-- dice niente). La regola vive in `validate_court_note`, quindi vale per
-- `add_court_note` e `edit_court_note` insieme; il CHECK resta il backstop
-- contro INSERT dirette come service_role (NULL passa, come voluto).
--
-- Le tre RPC non contengono allowlist/limiti inline (delegano a validate):
-- CREATE OR REPLACE a corpo invariato, stessa firma -> i grant restano
-- (docs/rpc.md: solo DROP + CREATE azzera i grant). Idempotente.

-- ============================================================================
-- 1. Rinomina le righe esistenti (no-op se la tabella e' vuota).
-- ============================================================================
UPDATE public.court_notes
SET kind = CASE kind
  WHEN 'canestro_rotto' THEN 'broken_hoop'
  WHEN 'chiuso' THEN 'closed'
  WHEN 'area_privata' THEN 'private_area'
  WHEN 'illuminazione' THEN 'no_lighting'
  WHEN 'superficie' THEN 'surface'
  WHEN 'altro' THEN 'other'
  ELSE kind
END
WHERE kind IN ('canestro_rotto', 'chiuso', 'area_privata',
               'illuminazione', 'superficie', 'altro');

-- ============================================================================
-- 2. Sostituisce i CHECK della 052 (nomi auto-generati
-- `court_notes_{kind,body}_check`): li droppa per nome effettivo cosi' la
-- migrazione non dipende dal naming, poi li ricrea con gli stessi nomi.
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.court_notes'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.court_notes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.court_notes
  ADD CONSTRAINT court_notes_kind_check
    CHECK (kind IN ('broken_hoop', 'closed', 'private_area',
                    'no_lighting', 'surface', 'other')),
  ADD CONSTRAINT court_notes_body_check
    CHECK (char_length(body) BETWEEN 1 AND 200);

-- ============================================================================
-- 3. Validazione condivisa: allowlist inglese, tetto 200, `other` con testo
-- obbligatorio. Stesse classi di errore della 052: solo P0001 qui dentro
-- (il 42501 resta nelle RPC chiamanti).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_court_note(
  p_kind TEXT,
  p_body TEXT,
  OUT o_kind TEXT,
  OUT o_body TEXT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('broken_hoop', 'closed', 'private_area',
                                      'no_lighting', 'surface', 'other') THEN
    RAISE EXCEPTION 'Tipo di nota non valido.' USING ERRCODE = 'P0001';
  END IF;
  o_kind := p_kind;

  -- NULL o solo spazi = nota senza testo (es. "Canestro rotto" non ha
  -- bisogno di spiegazioni); il CHECK 1..200 resta il backstop.
  o_body := NULLIF(TRIM(COALESCE(p_body, '')), '');
  IF o_kind = 'other' AND o_body IS NULL THEN
    RAISE EXCEPTION 'Con «Altro» il testo è obbligatorio: altrimenti la nota non dice niente.' USING ERRCODE = 'P0001';
  END IF;
  IF o_body IS NOT NULL AND char_length(o_body) > 200 THEN
    RAISE EXCEPTION 'La nota è troppo lunga (max 200 caratteri).' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_court_note(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 4. Le tre RPC: corpo invariato rispetto alla 052 (validazione delegata a
-- validate_court_note), CREATE OR REPLACE con stessa firma. I GRANT
-- EXECUTE TO authenticated della 052 restano: nessun DROP, nessuna
-- ri-concessione necessaria.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_court_note(
  p_court_id UUID,
  p_kind TEXT,
  p_body TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_kind TEXT;
  v_body TEXT;
  v_status TEXT;
  v_id UUID;
BEGIN
  v_uid := auth.uid();
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  -- service_role non ha riga in auth.users come autore: ripiega sul
  -- moderatore corrente quando il chiamante e' service_role senza uid.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT validate_court_note.o_kind, validate_court_note.o_body
    INTO v_kind, v_body
    FROM public.validate_court_note(p_kind, p_body);

  SELECT moderation_status INTO v_status
  FROM public.courts WHERE id = p_court_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campo inesistente.' USING ERRCODE = 'P0001';
  END IF;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Operazione consentita solo su campi approvati.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.court_notes (court_id, author_id, kind, body)
  VALUES (p_court_id, v_uid, v_kind, v_body)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_court_note(
  p_id UUID,
  p_kind TEXT,
  p_body TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_court_id UUID;
  v_kind TEXT;
  v_body TEXT;
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT court_id INTO v_court_id
  FROM public.court_notes WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota inesistente.' USING ERRCODE = 'P0001';
  END IF;

  SELECT validate_court_note.o_kind, validate_court_note.o_body
    INTO v_kind, v_body
    FROM public.validate_court_note(p_kind, p_body);

  SELECT moderation_status INTO v_status
  FROM public.courts WHERE id = v_court_id;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Operazione consentita solo su campi approvati.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.court_notes
  SET kind = v_kind, body = v_body
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_court_note(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_n INTEGER;
BEGIN
  v_uid := auth.uid();
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.court_notes WHERE id = p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Nota inesistente.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
