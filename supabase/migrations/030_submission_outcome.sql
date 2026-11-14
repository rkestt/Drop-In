-- 030_submission_outcome.sql
-- Chiude #47: esito della proposta e resubmit dopo un rifiuto.
--
-- Contesto: `approve_court`/`reject_court` cambiavano solo lo stato, senza
-- dirlo al proponente; una corte rifiutata restava nel DB invisibile e senza
-- percorso di correzione (`submit_court` applica comunque il rate limit di
-- 1/ora). Questa migration aggiunge:
--   1. `resubmit_submission`: il proprietario rimette in `pending` la propria
--      proposta rifiutata, con una NUOVA riga di audit (la rejected resta
--      come storia). E' un percorso di correzione, non un nuovo invio:
--      niente rate limit da 1/ora, ma due tetti anti-abuso letti dalle righe
--      di `court_submissions` (max 1 resubmit per corte al minuto, max 5
--      pending create nell'ultima ora per utente).
--   2. Notifica al proponente dentro `approve_court`/`reject_court`
--      (stesse firme, stesse guardie): una sola riga `push_notifications`
--      per chiamata, solo se la corte ha un `submitted_by`. Senza
--      proponente non fa nulla e non fallisce mai.
--
-- Perche' SECURITY DEFINER: la RLS su courts/court_submissions revoca
-- INSERT/UPDATE ad authenticated/anon (010), quindi il client non puo'
-- scrivere nemmeno le proprie righe; la RPC gira con i privilegi del
-- proprietario e riapplica i controlli dentro il proprio corpo, come le
-- RPC di moderazione e le RPC di 026. La INSERT in `push_notifications`
-- dentro approve/reject passa perche' gira sotto DEFINER (nessuna policy
-- INSERT sulla tabella, come gia' fa il trigger karma della 027).
-- Due classi di errore come in 026: 42501 = diniego di autorizzazione
-- (non autenticato), P0001 = validazione applicativa (proprieta'/stato,
-- tetti anti-abuso), con messaggi in italiano gia' pensati per la UI.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT, ri-eseguibile senza errori.

-- ============================================================================
-- resubmit_submission: il proprietario ripropone la propria rejected.
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

  -- Tetto 2: max 5 pending create nell'ultima ora per utente (submit +
  -- resubmit: il resubmit e' una correzione, ma resta un invio in coda).
  SELECT COUNT(*) INTO v_recent_user
  FROM public.court_submissions
  WHERE submitter_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '1 hour';
  IF v_recent_user >= 5 THEN
    RAISE EXCEPTION 'Hai inviato troppe proposte nell ultima ora. Riprova più tardi.' USING ERRCODE = 'P0001';
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
-- approve_court / reject_court: stessa firma, stesse guardie (018), piu' una
-- sola notifica al proponente. Senza submitted_by: nessun extra, nessun errore.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_court(p_court_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
  v_submitter UUID;
  v_name TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  -- Solo una proposta ancora in attesa si puo' approvare: la riga puo' aver
  -- gia' cambiato stato (doppio click, retry) e la notifica deve partire una
  -- sola volta, solo sulla transizione reale.
  UPDATE public.courts
  SET moderation_status = 'approved', duplicate_of = NULL
  WHERE id = p_court_id AND moderation_status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La proposta non è più in attesa di revisione.' USING ERRCODE = 'P0001';
  END IF;
  -- Solo la riga di audit ancora pending: le righe storiche (rejected con
  -- nota, approved precedenti) non si riscrivono mai.
  UPDATE public.court_submissions
  SET status = 'approved', moderation_note = p_note
  WHERE court_id = p_court_id AND status = 'pending';

  SELECT submitted_by, name INTO v_submitter, v_name
  FROM public.courts WHERE id = p_court_id;
  IF v_submitter IS NOT NULL THEN
    PERFORM public.notify_user(
      v_submitter,
      'Proposta approvata',
      'Il campo "' || v_name || '" ora è visibile sulla mappa.',
      jsonb_build_object('type', 'court_moderation', 'status', 'approved', 'court_id', p_court_id)
    );
  END IF;
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
  v_submitter UUID;
  v_name TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Non autorizzato.' USING ERRCODE = '42501';
  END IF;
  -- Come approve_court: solo la transizione reale da pending notifica, una volta sola.
  UPDATE public.courts SET moderation_status = 'rejected' WHERE id = p_court_id AND moderation_status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La proposta non è più in attesa di revisione.' USING ERRCODE = 'P0001';
  END IF;
  -- Solo la riga di audit ancora pending: le righe storiche restano intatte.
  UPDATE public.court_submissions SET status = 'rejected', moderation_note = p_note WHERE court_id = p_court_id AND status = 'pending';

  SELECT submitted_by, name INTO v_submitter, v_name
  FROM public.courts WHERE id = p_court_id;
  IF v_submitter IS NOT NULL THEN
    PERFORM public.notify_user(
      v_submitter,
      'Proposta rifiutata',
      'Il campo "' || v_name || '" non è stato approvato.'
        || CASE WHEN p_note IS NOT NULL THEN ' Motivo: ' || p_note ELSE '' END,
      jsonb_build_object('type', 'court_moderation', 'status', 'rejected', 'court_id', p_court_id)
    );
  END IF;
END;
$$;

-- Stesso modello della 012 punto 10 e della 026: revoca totale (PUBLIC incluso,
-- per i grant impliciti del boot di Supabase) e concessione ai soli ruoli
-- voluti. service_role in piu' per gli script operativi, come in 026.
REVOKE ALL ON FUNCTION public.resubmit_submission(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_submission(UUID) TO authenticated, service_role;
