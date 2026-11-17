-- 038_karma_reconfirm_no_in_progress.sql
-- Migrazione B della #91, solo DB (il client e' un'altra lane). Atterra dopo
-- la 037: il predicato nuovo legge `check_ins.lobby_id`, popolato dal
-- trigger `assign_check_in_lobby` della 037; prima, non penalizzerebbe
-- nessuno — silenzioso, peggio di un errore.
--
-- 1. Predicato del -3: solo chi ha `reconfirmed_at IS NOT NULL` E non ha un
--    check-in `status='active'` con `lobby_id = NEW.id`. Stesso nome, stesso
--    trigger, struttura della 027 conservata (loop per utente, SECURITY
--    DEFINER, riga `karma_loss`, testo notifica, `karma_score - 3` senza
--    floor: le regole di prodotto non si cambiano qui). Chi non riconferma
--    resta iscritto ma e' escluso dal -3, come da regola di prodotto.
-- 2. `notify_lobby_starting_soon` (002): solo ai riconfermati
--    (`lp.reconfirmed_at IS NOT NULL`), finestra 13-17 minuti invariata.
--    Il reminder di riconferma e' una notifica nuova, fuori da questa
--    issue: la finestra di starting_soon (-13/-17 min) e' dopo la chiusura
--    della riconferma (-30 min), un reminder li' sarebbe inutile.
-- 3. `in_progress` eliminato: nessuno lo scrive (solo 'open' all'INSERT e
--    'closed' in `auto_close_lobbies`); "in corso" si deriva con
--    `status='open' AND now() BETWEEN start_time AND ends_at` (036).
--    UPDATE difensivo delle righe residue, CHECK ristretto, guard che lo
--    citavano semplificati (anche l'indice parziale della 036).

-- ================= 1. predicato del -3 =================
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
          SELECT 1 FROM public.check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.lobby_id = NEW.id
            AND ci.status = 'active'
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

-- `CREATE OR REPLACE TRIGGER` non esiste: DROP + CREATE con il WHEN
-- semplificato (niente piu' `in_progress`).
DROP TRIGGER IF EXISTS trigger_decrement_karma_on_close ON public.lobbies;
CREATE TRIGGER trigger_decrement_karma_on_close
AFTER UPDATE ON public.lobbies
FOR EACH ROW
WHEN (OLD.status = 'open' AND NEW.status = 'closed')
EXECUTE FUNCTION decrement_karma_on_missed_check_in();

-- ================= 2. starting_soon solo ai riconfermati =================
CREATE OR REPLACE FUNCTION notify_lobby_starting_soon()
RETURNS VOID AS $$
BEGIN
  INSERT INTO push_notifications (user_id, title, body, data)
  SELECT
    lp.user_id,
    'La lobby sta per iniziare!',
    'La lobby al campo ' || c.name || ' inizia tra 15 minuti.',
    jsonb_build_object(
      'type', 'lobby_starting_soon',
      'lobby_id', l.id,
      'court_id', l.court_id,
      'start_time', l.start_time
    )
  FROM lobbies l
  JOIN courts c ON c.id = l.court_id
  JOIN lobby_participants lp ON lp.lobby_id = l.id
  WHERE l.status = 'open'
    AND l.start_time > NOW() + INTERVAL '13 minutes'
    AND l.start_time < NOW() + INTERVAL '17 minutes'
    -- #91: chi non ha riconfermato e' contato fuori, non lo si avvisa.
    AND lp.reconfirmed_at IS NOT NULL
    AND NOT EXISTS (
      -- Avoid duplicate notifications already sent
      SELECT 1 FROM push_notifications pn
      WHERE pn.user_id = lp.user_id
        AND pn.data->>'type' = 'lobby_starting_soon'
        AND pn.data->>'lobby_id' = l.id::text
    );
END;
$$ LANGUAGE plpgsql;

-- ================= 3. `in_progress` eliminato =================
-- Difensivo: le righe residue passate vanno a `closed`, le altre a `open`.
UPDATE public.lobbies SET status = 'closed'
WHERE status = 'in_progress' AND ends_at < NOW();
UPDATE public.lobbies SET status = 'open'
WHERE status = 'in_progress';

ALTER TABLE public.lobbies DROP CONSTRAINT lobbies_status_check;
ALTER TABLE public.lobbies
  ADD CONSTRAINT lobbies_status_check CHECK (status IN ('open', 'closed'));

CREATE OR REPLACE FUNCTION auto_close_lobbies()
RETURNS VOID AS $$
BEGIN
  UPDATE lobbies
  SET status = 'closed'
  WHERE status = 'open'
    AND ends_at < NOW();
END;
$$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS public.idx_lobbies_ends_at_open;
CREATE INDEX idx_lobbies_ends_at_open
  ON public.lobbies (ends_at)
  WHERE status = 'open';
