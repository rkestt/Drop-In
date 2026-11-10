-- d22 (centro notifiche): lettura/scrittura di `read_at` sulle proprie righe,
-- pubblicazione realtime di `public.push_notifications`, scrittura limitata
-- alla sola colonna `read_at`.
--
-- Idempotenza (pattern 008/015): policy via DO block con check su
-- `pg_policies`; funzione via CREATE OR REPLACE; trigger via
-- DROP IF EXISTS + CREATE. Il file è ri-eseguibile senza errori.
--
-- Nota Postgres: UPDATE non supporta column-list, quindi la policy da sola
-- permetterebbe al proprietario di riscrivere titolo/corpo/data delle
-- proprie righe. Il trigger BEFORE UPDATE sotto chiude il buco: solo
-- `read_at` è modificabile (da chiunque, incluso service_role — nessun
-- flusso admin riscrive questi campi).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_notifications'
      AND policyname = 'Users can mark own notifications read'
  ) THEN
    CREATE POLICY "Users can mark own notifications read"
      ON push_notifications
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION restrict_push_notifications_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.data IS DISTINCT FROM OLD.data
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'push_notifications: solo read_at modificabile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restrict_push_notifications_update
  ON push_notifications;

CREATE TRIGGER trg_restrict_push_notifications_update
  BEFORE UPDATE ON push_notifications
  FOR EACH ROW
  EXECUTE FUNCTION restrict_push_notifications_update();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'push_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.push_notifications;
  END IF;
END $$;
