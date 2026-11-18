-- 051_court_name_proposals.sql
-- Chiude #106 (lane C proposte-DB): i giocatori propongono il nome vero per
-- le corti con nome automatico (`is_auto_name` dalla 050); i moderatori
-- approvano (anche con modifica) o rifiutano con nota obbligatoria.
--
-- Tabella separata `court_name_proposals`, NON riuso di `court_submissions`:
-- quella e' 1-a-1 con una corte `pending` e muore con l'approvazione, mentre
-- qui la corte e' gia' `approved` e pubblica. Stessa architettura della
-- 010/012/026/030: RLS abilitata, REVOKE ALL da PUBLIC/anon/authenticated
-- (punto 10 della 012: il boot Supabase concede a PUBLIC di default), SELECT
-- solo `proposer_id = auth.uid() OR is_moderator()`, ZERO DML diretta —
-- scritture solo via RPC SECURITY DEFINER con SET search_path = public.
-- Perche' DEFINER e non RLS in scrittura: la RLS regola solo la lettura
-- (policy SELECT), ogni guardia di scrittura vive dentro la funzione, come
-- le RPC di moderazione e la 026. Due classi di errore come in 026/030:
-- 42501 = diniego di autorizzazione, P0001 = validazione applicativa.
--
-- Chiusura automatica delle pending quando la corte viene chiusa
-- (`rejected`/`duplicate`): la fa UN trigger BEFORE UPDATE OF
-- moderation_status (non l'estensione di reject_court/mark_duplicate: il
-- trigger copre qualunque percorso di chiusura, presente e futuro, in un
-- solo punto; reject_court della 030 transita comunque solo da pending, le
-- corti con proposte sono approved). Nota automatica distinta per i due
-- stati, decided_by NULL (chiusura di sistema, non decisione umana).
--
-- Anti-abuso come `resubmit_submission` in 030 (tetti letti dalle righe:
-- 1 proposta pending per campo al minuto, max 5 pending create nell'ultima
-- ora per utente, sotto pg_advisory_xact_lock per utente), NON il rate-limit
-- 1/ora di `submit_court` (031) che e' per nuovi campi. Indice unico
-- parziale (court_id, proposer_id) WHERE pending: una aperta per campo per
-- utente (backstop del controllo applicativo, che alza P0001 leggibile).
--
-- Il nome proposto NON puo' mai comparire in mappa/ricerca prima
-- dell'approvazione per costruzione: nearby_courts/courts_in_viewport
-- leggono solo courts.name, la tabella proposte non e' mai joinata
-- (regressione nei blocchi 59 di tests/rls/assertions.sql).
-- Idempotente: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS + REVOKE/GRANT.

-- ============================================================================
-- Tabella + vincoli + indici.
-- CHECK char_length 1..120: 120 = COURT_NAME_MAX in
-- lib/validation/schemas.ts, stessa regola di submit_court (031). Il trim e
-- il rifiuto dei blank vivono negli RPC (messaggi P0001 per la UI); il CHECK
-- e' il backstop contro INSERT dirette come service_role.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_name_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_name TEXT NOT NULL CHECK (char_length(proposed_name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  moderator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Una proposta aperta per campo per utente (il controllo applicativo negli
-- RPC alza P0001 leggibile; questo inchioda la corsa residua).
CREATE UNIQUE INDEX IF NOT EXISTS uq_name_proposals_court_proposer_pending
  ON public.court_name_proposals(court_id, proposer_id)
  WHERE status = 'pending';

-- Coda moderazione per campo (approve chiude le altre pending della corte).
CREATE INDEX IF NOT EXISTS idx_name_proposals_court_status
  ON public.court_name_proposals(court_id, status);

-- ============================================================================
-- RLS: il proponente vede solo le sue, il moderatore tutte, anon niente.
-- (anon mantiene il GRANT SELECT sotto ma la policy non gli matcha mai
-- nessuna riga: stesso modello di courts_select_all in 010.)
-- ============================================================================
ALTER TABLE public.court_name_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS court_name_proposals_select ON public.court_name_proposals;
CREATE POLICY court_name_proposals_select ON public.court_name_proposals
  FOR SELECT
  USING (proposer_id = auth.uid() OR public.is_moderator());

REVOKE ALL ON public.court_name_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.court_name_proposals TO anon, authenticated;
GRANT ALL ON public.court_name_proposals TO service_role;

-- ============================================================================
-- propose_court_name: un autenticato propone un nome per una corte approved.
-- Riusa il messaggio di require_approved_court (012) per le corti non
-- approvate. Ritorna l'id (al client serve per il ritiro).
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

  -- Tetto 2: max 5 proposte pending create nell'ultima ora per utente.
  SELECT COUNT(*) INTO v_recent_user
  FROM public.court_name_proposals
  WHERE proposer_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '1 hour';
  IF v_recent_user >= 5 THEN
    RAISE EXCEPTION 'Hai inviato troppe proposte nell ultima ora. Riprova più tardi.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.court_name_proposals (court_id, proposer_id, proposed_name)
  VALUES (p_court_id, v_uid, v_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- withdraw_name_proposal: il proprietario ritira la propria pending.
-- Modello retract_submission (026): riga altrui/inesistente/stato non
-- pending = 42501. Nessun controllo lobby (quello di retract serve perche'
-- cancella la corte con cascata; qui si flippa solo lo stato).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.withdraw_name_proposal(p_proposal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_owner UUID;
  v_n INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT proposer_id INTO v_owner
  FROM public.court_name_proposals WHERE id = p_proposal_id;

  IF NOT FOUND OR v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  -- Solo la pending si ritira: la riga puo' aver gia' cambiato stato
  -- (moderazione nel frattempo) e il ritiro non deve resuscitarla.
  UPDATE public.court_name_proposals
  SET status = 'withdrawn'
  WHERE id = p_proposal_id AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Solo le proposte in attesa si possono ritirare.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================================
-- approve_name_proposal: il moderatore approva, con override opzionale del
-- nome (il caso "correggo invece di accettare" in un passo solo).
-- All'approvazione: courts.name = nome finale, is_auto_name = false (il nome
-- vero sostituisce il generico), vincitrice -> approved, le altre pending
-- sulla stessa corte -> rejected con nota automatica.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_name_proposal(
  p_proposal_id UUID,
  p_edited_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_court_id UUID;
  v_proposed TEXT;
  v_final TEXT;
  v_court_status TEXT;
  v_n INTEGER;
BEGIN
  v_uid := auth.uid();
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  SELECT court_id, proposed_name INTO v_court_id, v_proposed
  FROM public.court_name_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta inesistente.' USING ERRCODE = 'P0001';
  END IF;

  v_final := NULLIF(TRIM(COALESCE(p_edited_name, v_proposed)), '');
  IF v_final IS NULL THEN
    RAISE EXCEPTION 'Inserisci un nome.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_final) > 120 THEN
    RAISE EXCEPTION 'Il nome è troppo lungo.' USING ERRCODE = 'P0001';
  END IF;

  SELECT moderation_status INTO v_court_status
  FROM public.courts WHERE id = v_court_id;
  IF v_court_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Operazione consentita solo su campi approvati.' USING ERRCODE = 'P0001';
  END IF;

  -- Solo la transizione reale da pending (doppio click, retry, chiusura
  -- d'ufficio nel frattempo): una sola approvazione, mai resuscitare.
  UPDATE public.court_name_proposals
  SET status = 'approved',
      proposed_name = v_final,
      decided_at = now(),
      decided_by = v_uid
  WHERE id = p_proposal_id AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La proposta non è più in attesa di revisione.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.courts
  SET name = v_final, is_auto_name = false
  WHERE id = v_court_id;

  UPDATE public.court_name_proposals
  SET status = 'rejected',
      moderator_note = 'Un altro nome è stato approvato per questo campo.',
      decided_at = now(),
      decided_by = v_uid
  WHERE court_id = v_court_id AND status = 'pending' AND id <> p_proposal_id;
END;
$$;

-- ============================================================================
-- reject_name_proposal: il moderatore rifiuta con nota OBBLIGATORIA (stesso
-- principio di my-submissions: la rejected mostra sempre il motivo).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_name_proposal(
  p_proposal_id UUID,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_note TEXT;
  v_n INTEGER;
BEGIN
  v_uid := auth.uid();
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;

  v_note := NULLIF(TRIM(COALESCE(p_note, '')), '');
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Indica il motivo del rifiuto.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals WHERE id = p_proposal_id) THEN
    RAISE EXCEPTION 'Proposta inesistente.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.court_name_proposals
  SET status = 'rejected',
      moderator_note = v_note,
      decided_at = now(),
      decided_by = v_uid
  WHERE id = p_proposal_id AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La proposta non è più in attesa di revisione.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ============================================================================
-- Chiusura d'ufficio: se la corte viene rifiutata o marcata duplicata, le
-- pending referenziano un nome che non esiste piu' -> rejected con nota
-- automatica (decided_by NULL: chiusura di sistema). Trigger, non estensione
-- degli RPC: un solo punto per qualunque percorso di chiusura.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.close_name_proposals_on_court_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.moderation_status IN ('rejected', 'duplicate')
     AND OLD.moderation_status IS DISTINCT FROM NEW.moderation_status THEN
    UPDATE public.court_name_proposals
    SET status = 'rejected',
        moderator_note = CASE NEW.moderation_status
          WHEN 'duplicate' THEN 'La proposta è stata chiusa: il campo è stato marcato come duplicato.'
          ELSE 'La proposta è stata chiusa: il campo è stato rifiutato.'
        END,
        decided_at = now(),
        decided_by = NULL
    WHERE court_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_name_proposals ON public.courts;
CREATE TRIGGER trg_close_name_proposals
  BEFORE UPDATE OF moderation_status ON public.courts
  FOR EACH ROW EXECUTE FUNCTION public.close_name_proposals_on_court_close();

-- ============================================================================
-- Grant: modello 012 punto 10 + 026. Scritture solo via RPC (nessuna DML
-- diretta: la RLS non ha policy INSERT/UPDATE/DELETE).
-- ============================================================================
REVOKE ALL ON FUNCTION public.propose_court_name(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdraw_name_proposal(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_name_proposal(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_name_proposal(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.propose_court_name(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_name_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_name_proposal(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_name_proposal(UUID, TEXT) TO authenticated;
