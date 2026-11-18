-- 052_court_notes.sql
-- Chiude #90 (lane A Note di campo, DB): note datate sull'agibilita' dei
-- campi — tipo, data, autore. Niente stato binario: il campo non viene mai
-- nascosto né bloccato, le note si mostrano e l'uso resta a discrezione di
-- chi gioca. Inserimento solo moderatore per ora; segnalazioni utente dopo
-- la beta riusando la coda di moderazione.
--
-- Tabella separata `court_notes` (una riga = un avviso datato), NON una
-- colonna su courts: le note sono molte-per-campo e storiche, mai un flag.
-- Stessa architettura della 010/012/026/030/051: RLS abilitata, REVOKE ALL
-- da PUBLIC/anon/authenticated (punto 10 della 012: il boot Supabase
-- concede a PUBLIC di default), UNA sola policy SELECT (note di corti
-- `approved`: avviso pubblico a chi gioca, non dato sensibile — al
-- contrario delle proposte altrui, che la 051 nasconde apposta), ZERO DML
-- diretta — scritture solo via RPC SECURITY DEFINER con
-- SET search_path = public. Due classi di errore come in 026/030/051:
-- 42501 = diniego di autorizzazione, P0001 = validazione applicativa.
--
-- `kind` TEXT + CHECK: convenzione del repo (`moderation_status` TEXT +
-- CHECK in 010, `status` TEXT + CHECK in 051). La allowlist vive negli RPC
-- (come `sport` in `submit_court`, 010/012); il CHECK e' il backstop contro
-- INSERT dirette come service_role. `body` opzionale (un canestro rotto non
-- ha bisogno di testo), tetto 500: righe brevi, non recensioni. Il trim e
-- la normalizzazione dei blank vivono negli RPC (un body vuoto/blank
-- diventa NULL: "senza testo"); il CHECK char_length 1..500 e' il backstop
-- (NULL passa il CHECK, come voluto).
--
-- `author_id ... ON DELETE CASCADE`: coerente con `proposer_id` della 051
-- (la nota e' opera dell'autore, come la proposta). Non SET NULL: quello e'
-- il modello di `decided_by`/`submitted_by` (010/051), dove serve il
-- fallback "decisione di sistema".
--
-- Niente `resolved_at`/`superseded_by`, niente `status`, niente `source`:
-- le note vecchie si attutiscono in UI oltre 90 giorni
-- (COURT_NOTE_STALE_DAYS), mai nascoste — e' regola di presentazione, non
-- di schema. Le RPC di lettura (`nearby_courts`, `courts_in_viewport`) NON
-- si toccano (docs/rpc.md: due RPC diverse, non allineare colonne a caso):
-- la lane B legge con query additiva sulla scheda campo.
-- Idempotente: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS + REVOKE/GRANT.

-- ============================================================================
-- Tabella + vincoli + indici.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('canestro_rotto', 'chiuso', 'area_privata',
                    'illuminazione', 'superficie', 'altro')),
  body TEXT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lettura scheda campo: note di una corte, piu' recenti prima.
CREATE INDEX IF NOT EXISTS idx_court_notes_court_created
  ON public.court_notes(court_id, created_at DESC);

-- ============================================================================
-- RLS: lettura pubblica delle sole note di corti approved; scritture solo
-- via RPC (nessuna policy INSERT/UPDATE/DELETE).
-- ============================================================================
ALTER TABLE public.court_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS court_notes_select ON public.court_notes;
CREATE POLICY court_notes_select ON public.court_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = court_notes.court_id
        AND c.moderation_status = 'approved'
    )
  );

REVOKE ALL ON public.court_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.court_notes TO anon, authenticated;
GRANT ALL ON public.court_notes TO service_role;

-- ============================================================================
-- Validazione condivisa: allowlist kind + trim/normalizzazione body.
-- Il blank diventa NULL (nota senza testo); oltre 500 caratteri -> P0001.
-- Funzione di supporto, non esposta: senza GRANT resta ineseguibile via API.
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
  IF p_kind IS NULL OR p_kind NOT IN ('canestro_rotto', 'chiuso', 'area_privata',
                                      'illuminazione', 'superficie', 'altro') THEN
    RAISE EXCEPTION 'Tipo di nota non valido.' USING ERRCODE = 'P0001';
  END IF;
  o_kind := p_kind;

  -- NULL o solo spazi = nota senza testo (es. "canestro rotto" non ha
  -- bisogno di spiegazioni); il CHECK 1..500 resta il backstop.
  o_body := NULLIF(TRIM(COALESCE(p_body, '')), '');
  IF o_body IS NOT NULL AND char_length(o_body) > 500 THEN
    RAISE EXCEPTION 'La nota è troppo lunga (max 500 caratteri).' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_court_note(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- add_court_note: il moderatore annota una corte approved. Ritorna l'id
-- (al pannello serve per modifica/cancellazione).
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

-- ============================================================================
-- edit_court_note: il moderatore corregge kind/body di una nota. Stesse
-- guardie di add (moderatore + corte approved): la riga altrui/inesistente
-- e' 42501 come withdraw_name_proposal in 051, la validazione e' P0001.
-- ============================================================================
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

-- ============================================================================
-- delete_court_note: il moderatore rimuove una nota (inesistente -> P0001).
-- ============================================================================
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

-- ============================================================================
-- Grant: modello 012 punto 10 + 026/051. Scritture solo via RPC (nessuna
-- DML diretta: la RLS non ha policy INSERT/UPDATE/DELETE). I moderatori
-- sono utenti autenticati: la guardia is_moderator() dentro le funzioni fa
-- il resto, come approve/reject_name_proposal in 051.
-- ============================================================================
REVOKE ALL ON FUNCTION public.add_court_note(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edit_court_note(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_court_note(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_court_note(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_court_note(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_court_note(UUID) TO authenticated;
