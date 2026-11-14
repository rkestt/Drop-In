-- 032_mark_duplicate_pending_audit.sql
--
-- Come la 030 per approve/reject (B2): `mark_duplicate` aggiornava TUTTE le
-- righe di audit della corte (`WHERE court_id = ...` senza filtro di stato),
-- riscrivendo la storia (rejected con nota, approved precedenti). Ora tocca
-- solo la riga ancora `pending`; le righe storiche restano intatte.
-- La 018 resta invariata (gia' applicata): stessa firma, CREATE OR REPLACE,
-- GRANT intatti. Idempotente.

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
  UPDATE public.court_submissions SET status = 'duplicate' WHERE court_id = p_court_id AND status = 'pending';
END;
$$;
