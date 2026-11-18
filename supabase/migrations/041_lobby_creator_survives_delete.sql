-- 041_lobby_creator_survives_delete.sql
-- Chiude #94 (Lane A, parte dati): `lobbies.creator_id` diventa nullable
-- con `ON DELETE SET NULL`. La lobby sopravvive senza creatore: e'
-- congelata perche' nessuna policy la lascia modificare a un non-creatore
-- (`USING (auth.uid() = creator_id)` e' NULL-opaca su creator_id NULL:
-- il confronto `uuid = NULL` non e' mai true, quindi nessun UPDATE passa),
-- e il cron la chiude perche' gira come `postgres` (bypassa RLS).
--
-- Verificato che niente assume NOT NULL:
-- - indice `idx_lobbies_status_court` e' su (status, court_id);
-- - policy INSERT `WITH CHECK (auth.uid() = creator_id)`: un INSERT senza
--   creatore fallisce comunque (NULL non e' mai true nel CHECK);
-- - trigger di notifica 002/040: `NEW.user_id != lobby_creator_id` con
--   creator NULL e' NULL, quindi nessuna notifica al creatore sparito
--   (nessun crash, solo ramo non preso).
--
-- I trigger 037-040 restano invariati: operano sulle righe partecipanti,
-- non sul creatore.

ALTER TABLE public.lobbies
  ALTER COLUMN creator_id DROP NOT NULL;

ALTER TABLE public.lobbies
  DROP CONSTRAINT lobbies_creator_id_fkey;

ALTER TABLE public.lobbies
  ADD CONSTRAINT lobbies_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lobbies.creator_id IS
  'NULL = creatore eliminato (#94): lobby congelata, nessuna policy la lascia modificare, il cron la chiude.';
