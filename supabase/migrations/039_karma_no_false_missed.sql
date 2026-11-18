-- 039_karma_no_false_missed.sql
-- #91, correzioni al -3 dopo la review della B: il -3 colpiva anche chi era
-- in campo (check-in prima della riconferma, checkout manuale, arrivo in
-- anticipo) e la policy di join permetteva `reconfirmed_at` preimpostato.
-- La decisione e' nel thread della issue, qui solo l'esecuzione.
--
-- 1. Backfill alla riconferma: chi fa check-in PRIMA di riconfermare resta
--    con `lobby_id` NULL per sempre (l'assign della 037 aggancia solo
--    all'INSERT). Trigger AFTER UPDATE OF reconfirmed_at, SECURITY DEFINER:
--    quando passa a non-null collega i check-in `active` dell'utente sulla
--    stessa corte con `checked_in_at` in [start - 2h, ends_at], una sola
--    lobby (start piu' vicino). Mai RAISE: se non trova, resta NULL.
-- 2. Presenza, non stato: il predicato del -3 chiedeva un check-in
--    `status='active'`; chi esce dopo 2h (auto-checkout) o fa checkout
--    manuale prendeva -3 pur essendo stato li'. Ora conta la presenza:
--    check-in con `lobby_id = NEW.id` e `checked_in_at` in [start - 2h,
--    ends_at], indipendentemente dallo status.
-- 3. Check-in in anticipo: `assign_check_in_lobby` agganciava solo da
--    start - 30min; chi arriva 45 minuti prima restava NULL. Bound allineato
--    a start - 2h (stesso orizzonte del punto 2, coerente con
--    l'auto-checkout) + spareggio deterministico su (start, id).
-- 4. Buco sull'INSERT: la policy di join permetteva `reconfirmed_at` gia'
--    valorizzato, scavalcando la finestra. `reconfirmed_at IS NULL` nel
--    WITH CHECK, qui, senza toccare la 001.

-- ================= 1. backfill alla riconferma =================
CREATE OR REPLACE FUNCTION public.backfill_check_in_lobby_on_reconfirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court UUID;
  v_checkin RECORD;
  v_lobby UUID;
BEGIN
  -- Solo la transizione NULL -> non-null; nient'altro da fare qui, mai RAISE.
  IF OLD.reconfirmed_at IS NOT NULL OR NEW.reconfirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT court_id INTO v_court
  FROM public.lobbies
  WHERE id = NEW.lobby_id;
  IF v_court IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_checkin IN
    SELECT id, COALESCE(checked_in_at, NOW()) AS v_at
    FROM public.check_ins
    WHERE user_id = NEW.user_id
      AND court_id = v_court
      AND lobby_id IS NULL
      AND status = 'active'
  LOOP
    SELECT l.id INTO v_lobby
    FROM public.lobbies l
    JOIN public.lobby_participants lp
      ON lp.lobby_id = l.id
     AND lp.user_id = NEW.user_id
    WHERE l.court_id = v_court
      AND l.status = 'open'
      AND lp.reconfirmed_at IS NOT NULL
      AND l.start_time - INTERVAL '2 hours' <= v_checkin.v_at
      AND v_checkin.v_at <= l.ends_at
    ORDER BY abs(extract(epoch from (l.start_time - v_checkin.v_at))) ASC,
             l.start_time ASC, l.id ASC
    LIMIT 1;

    IF v_lobby IS NOT NULL THEN
      UPDATE public.check_ins SET lobby_id = v_lobby WHERE id = v_checkin.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_backfill_check_in_lobby_on_reconfirm ON public.lobby_participants;
CREATE TRIGGER trigger_backfill_check_in_lobby_on_reconfirm
AFTER UPDATE OF reconfirmed_at ON public.lobby_participants
FOR EACH ROW
EXECUTE FUNCTION public.backfill_check_in_lobby_on_reconfirm();

-- ================= 2. predicato di presenza =================
CREATE OR REPLACE FUNCTION public.decrement_karma_on_missed_check_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_name TEXT;
  v_user RECORD;
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    SELECT c.name INTO v_court_name
    FROM public.courts c
    WHERE c.id = NEW.court_id;

    FOR v_user IN
      SELECT lp.user_id
      FROM public.lobby_participants lp
      WHERE lp.lobby_id = NEW.id
        AND lp.reconfirmed_at IS NOT NULL
        AND NOT EXISTS (
          -- Presenza, non stato: chi era in campo (anche con checkout
          -- manuale o auto-checkout dopo 2h) non perde karma.
          SELECT 1 FROM public.check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.lobby_id = NEW.id
            AND COALESCE(ci.checked_in_at, NEW.start_time)
                BETWEEN NEW.start_time - INTERVAL '2 hours' AND NEW.ends_at
        )
    LOOP
      UPDATE public.profiles
      SET karma_score = karma_score - 3
      WHERE user_id = v_user.user_id;

      INSERT INTO public.push_notifications (user_id, title, body, data)
      VALUES (
        v_user.user_id,
        'Karma perso',
        'Non hai fatto check-in per la lobby a '
          || COALESCE(v_court_name, 'un campo')
          || '. Hai perso 3 punti Karma.',
        jsonb_build_object(
          'type', 'karma_loss',
          'lobby_id', NEW.id,
          'points_lost', 3
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- ================= 3. anticipo a 2h + spareggio deterministico =================
CREATE OR REPLACE FUNCTION public.assign_check_in_lobby()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at TIMESTAMPTZ;
BEGIN
  IF NEW.lobby_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_at := COALESCE(NEW.checked_in_at, NOW());

  SELECT l.id INTO NEW.lobby_id
  FROM public.lobbies l
  JOIN public.lobby_participants lp
    ON lp.lobby_id = l.id
   AND lp.user_id = NEW.user_id
  WHERE l.court_id = NEW.court_id
    AND l.status = 'open'
    AND lp.reconfirmed_at IS NOT NULL
    AND l.start_time - INTERVAL '2 hours' <= v_at
    AND v_at <= l.ends_at
  ORDER BY abs(extract(epoch from (l.start_time - v_at))) ASC,
           l.start_time ASC, l.id ASC
  LIMIT 1;

  RETURN NEW;
END;
$$;

-- ================= 4. join senza reconfirmed_at preimpostato =================
DROP POLICY IF EXISTS "Authenticated users can join lobbies" ON public.lobby_participants;
CREATE POLICY "Authenticated users can join lobbies" ON public.lobby_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id AND reconfirmed_at IS NULL);
