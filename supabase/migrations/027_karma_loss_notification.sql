-- 027_karma_loss_notification.sql
-- Ripristina la notifica di perdita Karma, persa nella 007.
--
-- Storia: la 002 aveva esteso `decrement_karma_on_missed_check_in()` con un
-- INSERT in `push_notifications` per ogni partecipante penalizzato (payload
-- `{"type":"karma_loss","lobby_id":…,"points_lost":3}`). La 007 ha
-- riscritto la funzione per correggere il predicato del check-in (per
-- `lobby_id` invece che per `court_id`) ma ha ricreato la funzione **senza**
-- l'INSERT: da allora nessuna riga `karma_loss` viene mai creata, quindi il
-- centro notifiche non mostra le penalità e la sezione karma della storia
-- del profilo (#26) resta vuota per costruzione.
--
-- Questa migrazione ricrea la funzione con:
--   * il predicato della 007 (invariato: partecipanti senza check-in attivo
--     sulla corte della lobby, aritmetica `karma_score - 3` senza floor,
--     come la 007 — non si cambiano le regole di prodotto);
--   * l'INSERT della 002 (titolo/corpo/payload identici: `mapKarmaRow` in
--     `lib/profile/history.ts` e `notificationHref` si aspettano
--     `data.type = 'karma_loss'`);
--   * `SECURITY DEFINER SET search_path = public`: la 002/007 giravano come
--     invoker e l'INSERT sarebbe stato filtrato dalla RLS di
--     `push_notifications` (nessuna policy INSERT) se la lobby fosse stata
--     chiusa da un utente invece che dal cron. La funzione scrive solo karma
--     e notifiche, quindi il DEFINER non allarga la superficie.
--
-- Nessun cambio di schema, nessun indice: `push_notifications` è già
-- indicizzata su `user_id` e la storia legge le ultime 10 righe per utente.

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
  IF NEW.status = 'closed' AND OLD.status IN ('open', 'in_progress') THEN
    SELECT c.name INTO v_court_name
    FROM public.courts c
    WHERE c.id = NEW.court_id;

    FOR v_user IN
      SELECT lp.user_id
      FROM public.lobby_participants lp
      WHERE lp.lobby_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM public.check_ins ci
          WHERE ci.user_id = lp.user_id
            AND ci.court_id = NEW.court_id
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

-- `CREATE OR REPLACE` conserva i grant esistenti sulla funzione; il trigger
-- `trigger_decrement_karma_on_close` (001) resta agganciato.
