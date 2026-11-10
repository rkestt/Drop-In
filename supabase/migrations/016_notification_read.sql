-- d22 (centro notifiche): lettura/scrittura di `read_at` sulle proprie righe
-- e pubblicazione realtime di `public.push_notifications`.
--
-- La SELECT sulle proprie righe esiste già (001: "Users can view own
-- notifications"). Qui si aggiunge l'UPDATE vincolato al proprietario:
-- un utente può marcare come lette solo le proprie notifiche.
-- Entrambe le istruzioni sono idempotenti (IF NOT EXISTS / DO block).

CREATE POLICY "Users can mark own notifications read"
  ON push_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
