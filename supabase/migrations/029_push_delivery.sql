-- 029_push_delivery.sql
-- Marcatori di recapito per la Edge Function `send-push` (issue #25).
--
-- `push_notifications.sent_at` ha DEFAULT now() all'INSERT: marca la
-- creazione della riga, NON il recapito. Non puo' quindi distinguere "da
-- inviare" da "inviato": per questo servono le tre colonne sotto.
--   * `push_sent_at`: quando la push e' stata recapitata ad almeno un
--     endpoint dell'utente (NULL = mai recapitata);
--   * `push_attempts`: tentativi di sweep falliti (un tentativo = uno sweep
--     che non ha recapitato a nessuna subscription; 404/410 cancellano la
--     subscription e non contano come fallimento della riga);
--   * `push_failed_at`: quando la riga ha esaurito i tentativi (5) e non
--     verra' piu' ritentata.
-- Lo sweep della function seleziona le righe con `push_sent_at IS NULL AND
-- push_failed_at IS NULL AND push_attempts < 5` (indice parziale sotto).
--
-- Scrittura: gli utenti continuano a poter cambiare solo `read_at`
-- (comportamento invariato, stesso messaggio di errore); `service_role`
-- (la Edge Function) puo' in piu' avanzare solo i tre marcatori di
-- recapito, senza poter riscrivere `id`, `user_id`, `title`, `body`, `data`
-- o `sent_at`. Il controllo del ruolo segue lo stesso pattern degli altri
-- guard di questo repo (028): nessun claim JWT (psql/cron come postgres)
-- o `role = 'service_role'` => ramo privilegiato.

ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;
ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS push_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS push_failed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_push_notifications_undelivered
  ON public.push_notifications (sent_at)
  WHERE push_sent_at IS NULL AND push_failed_at IS NULL;

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
    -- read_at, come prima) sono modificabili.
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

DROP TRIGGER IF EXISTS trg_restrict_push_notifications_update
  ON push_notifications;

CREATE TRIGGER trg_restrict_push_notifications_update
  BEFORE UPDATE ON push_notifications
  FOR EACH ROW
  EXECUTE FUNCTION restrict_push_notifications_update();

-- Subscription: l'utente gestisce le proprie righe via RLS (policy
-- "Users can manage own push subscriptions" dalla 001, invariata). Qui solo
-- grant espliciti: la tabella eredita i default del progetto (ALL anche ad
-- anon), ma anon non deve toccarla — la policy lo bloccherebbe comunque,
-- il REVOKE chiude anche il privilegio.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
REVOKE ALL ON public.push_subscriptions FROM anon;
