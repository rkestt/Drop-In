-- d6 (must-close oracle): il KarmaListener dipende dalla riga completa
-- prima/dopo l'UPDATE su public.profiles.
--
-- 1. Senza REPLICA IDENTITY FULL, con il default (d) payload.old contiene
--    solo la PK: il delta karma verrebbe calcolato contro il fallback (90)
--    e mostrerebbe un testo sbagliato.
-- 2. profiles non era nella pubblicazione supabase_realtime: nessun evento
--    arrivava al client.
--
-- Entrambe le istruzioni sono idempotenti (blocco DO con IF NOT EXISTS,
-- ALTER ri-eseguibile senza effetti).

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
