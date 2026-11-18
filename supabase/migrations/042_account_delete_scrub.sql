-- 042_account_delete_scrub.sql
-- Chiude #94 (Lane B, prerequisito della route): la cancellazione account
-- toglie la chiave `user_id` dalle notifiche altrui (uno UUID in un JSON di
-- qualcun altro e' dato personale), ma il trigger della 029 vieta a
-- chiunque — service_role incluso — qualunque UPDATE di `data`.
-- Senza eccezione lo scrub sarebbe impossibile: nessuna cascata lo fa
-- (le righe altrui restano) e riscriverle a mano perderebbe id/sent_at.
--
-- Eccezione stretta, solo per service_role (o sessioni senza claim JWT:
-- psql/cron come postgres): l'UPDATE passa solo se l'unico cambio e'
-- `NEW.data = OLD.data - 'user_id'`. Titolo, corpo, riassegnazioni e
-- qualunque altra riscrittura di `data` restano vietate come prima
-- (blocco RLS 40d e nuovo 51c); `read_at` resta libero come prima.
-- `jsonb_typeof = 'object'` evita sorprese su `data` scalari.

CREATE OR REPLACE FUNCTION restrict_push_notifications_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');

  IF v_role IS NULL OR v_role = 'service_role' THEN
    -- Edge Function / manutenzione: solo i marcatori di recapito (e
    -- read_at, come prima) sono modificabili, piu' lo scrub #94.
    IF jsonb_typeof(OLD.data) = 'object'
      AND NEW.data = (OLD.data - 'user_id')
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      AND NEW.title IS NOT DISTINCT FROM OLD.title
      AND NEW.body IS NOT DISTINCT FROM OLD.body
      AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
      AND NEW.push_sent_at IS NOT DISTINCT FROM OLD.push_sent_at
      AND NEW.push_attempts IS NOT DISTINCT FROM OLD.push_attempts
      AND NEW.push_failed_at IS NOT DISTINCT FROM OLD.push_failed_at THEN
      RETURN NEW;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.data IS DISTINCT FROM OLD.data
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
      RAISE EXCEPTION 'push_notifications: solo read_at modificabile';
    END IF;
    RETURN NEW;
  END IF;

  -- Utenti: solo read_at, come dalla 016 (i marcatori push sono
  -- aggiunti al divieto).
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.data IS DISTINCT FROM OLD.data
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.push_sent_at IS DISTINCT FROM OLD.push_sent_at
    OR NEW.push_attempts IS DISTINCT FROM OLD.push_attempts
    OR NEW.push_failed_at IS DISTINCT FROM OLD.push_failed_at THEN
    RAISE EXCEPTION 'push_notifications: solo read_at modificabile';
  END IF;
  RETURN NEW;
END;
$$;
