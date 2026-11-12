-- 026_pending_submission_edit.sql
-- Chiude #58: il proprietario di una proposta pending puo' ritirarla
-- (`retract_submission`) o correggerla (`update_pending_submission`) prima
-- della moderazione. Oggi `submit_court` crea una corte invisibile al
-- pubblico senza alcun percorso di correzione per chi l'ha inviata.
--
-- Perche' SECURITY DEFINER: la RLS su courts/court_submissions revoca
-- INSERT/UPDATE/DELETE ad authenticated/anon (010), quindi il client non
-- puo' scrivere direttamente nemmeno le proprie righe; le due RPC girano
-- con i privilegi del proprietario della funzione e riapplicano i controlli
-- dentro il proprio corpo.
-- Perche' il controllo di proprieta' e' in SQL e non solo in RLS: la RLS
-- regola solo la lettura (policy courts_select_all); le scritture passano
-- esclusivamente dagli RPC, quindi ogni guardia di scrittura deve vivere
-- dentro la funzione DEFINER, come gia' fanno le RPC di moderazione.
-- Due classi di errore: 42501 = diniego di autorizzazione (non autenticato,
-- riga altrui o inesistente, stato non pending), P0001 = validazione
-- applicativa (nome, sport, percorso foto), come `submit_court`.

-- ============================================================================
-- retract_submission: il proprietario ritira la propria proposta pending.
-- La riga di audit in court_submissions segue la corte via
-- court_submissions_court_id_fkey (ON DELETE CASCADE). L'oggetto foto in
-- court-photos non viene toccato qui: lo rimuove il client dopo la RPC
-- riuscita, oppure la GC degli orfani (docs/photos-gc.md).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.retract_submission(p_court_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_owner UUID;
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT submitted_by, moderation_status INTO v_owner, v_status
  FROM public.courts WHERE id = p_court_id;

  -- Riga inesistente, altrui o con submitted_by NULL: stesso diniego.
  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Solo le proposte in attesa si possono ritirare.' USING ERRCODE = '42501';
  END IF;

  -- La FK courts -> lobbies e' ON DELETE CASCADE (a cascata anche
  -- partecipanti, check-in e preferiti): senza questo controllo il ritiro
  -- cancellerebbe le lobby collegate. Le pending non possono avere lobby
  -- grazie ai guard P0001 (012), ma il ritiro non deve dipendere da
  -- quell'invariante esterno.
  IF EXISTS (SELECT 1 FROM public.lobbies WHERE court_id = p_court_id) THEN
    RAISE EXCEPTION 'La proposta ha già lobby collegate e non si può ritirare.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.courts WHERE id = p_court_id;
END;
$$;

-- ============================================================================
-- update_pending_submission: il proprietario corregge nome/sport/superficie
-- (e foto, solo se ne passa una nuova) della propria proposta pending, senza
-- toccare moderation_status/status. Validazione identica a `submit_court`
-- (012): nome trimmato, max 120, vuoto solo con foto esistente o nuova;
-- allowlist sport invariata; surface_type testo libero (nessun vincolo in
-- `submit_court`, nessuno qui); percorso foto con prefisso uid e senza
-- traversal, come la 012.
-- ============================================================================
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

  IF p_sport IS NOT NULL AND p_sport NOT IN ('basketball','soccer','tennis','volleyball','padel','futsal','multi','altro') THEN
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

-- Stesso modello della 012 punto 10: revoca totale (PUBLIC incluso, per i
-- grant impliciti del boot di Supabase) e concessione ai soli ruoli voluti.
-- service_role in piu' per gli script operativi, come nearby_courts (022/023).
REVOKE ALL ON FUNCTION public.retract_submission(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_pending_submission(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retract_submission(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_pending_submission(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
