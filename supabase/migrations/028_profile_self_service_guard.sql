-- 028_profile_self_service_guard.sql
-- Chiude il self-service su `profiles`: la policy UPDATE e'
-- `auth.uid() = user_id` senza restrizioni di colonna, e
-- `guard_profile_moderator` (010, riscritto in 012) sorveglia solo
-- `is_moderator`. Senza questo guard un utente autenticato poteva fare
-- `UPDATE profiles SET karma_score = 100 ... WHERE user_id = <self>`
-- (self-karma), `SET banned_until = NULL` (self-unban) e puntare
-- `avatar_url` sull'oggetto avatar di un altro utente.
--
-- Tre rami, in quest'ordine:
--  1. Nessun claim JWT (psql/seed/cron come postgres) o
--     `role = 'service_role'`: tutto permesso. Stesso escape hatch di
--     `guard_profile_moderator` (012): senza, migrazioni e script operativi
--     non potrebbero toccare karma/ban.
--  2. `pg_trigger_depth() > 1`: scrittura interna di un altro trigger.
--     `increment_karma_on_check_in`, `decrement_karma_on_missed_check_in`
--     ed `enforce_ban_on_low_karma` aggiornano `karma_score`/`banned_until`
--     dentro la sessione dell'utente (INSERT check-in o chiusura lobby con
--     claim authenticated). Un controllo sul solo ruolo le bloccherebbe:
--     la profondita' e' il discriminante — una UPDATE PostgREST diretta
--     gira a depth 1, una UPDATE lanciata da un trigger gira a depth >= 2.
--  3. UPDATE diretta del client (depth 1 con claim authenticated): nega con
--     42501 qualunque cambio di `karma_score`, `banned_until` o
--     `is_moderator` (quest'ultimo e' gia' coperto da
--     `guard_profile_moderator`, qui ribadito per difesa in profondita'; il
--     trigger esistente NON viene toccato), e nega con 42501 un `avatar_url`
--     non NULL fuori dal prefisso dell'utente.
--
-- `profiles.avatar_url` da questa migrazione in poi contiene il bare path
-- `<uid>/<uuid>.jpg` (il client scrive `uploaded.path`); la forma storica
-- (URL pubblico assoluto) resta accettata per le righe esistenti, quindi la
-- regola avatar ammette entrambe: prefisso `uid/` oppure URL pubblico
-- `.../avatars/<uid>/...`.

CREATE OR REPLACE FUNCTION public.guard_profile_self_service()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
  v_uid UUID;
BEGIN
  v_role := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.karma_score IS DISTINCT FROM OLD.karma_score
    OR NEW.banned_until IS DISTINCT FROM OLD.banned_until
    OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator THEN
    RAISE EXCEPTION 'Non autorizzato a modificare il profilo.' USING ERRCODE = '42501';
  END IF;

  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    v_uid := auth.uid();
    IF v_uid IS NULL
      OR (NEW.avatar_url IS NOT NULL
        AND NEW.avatar_url NOT LIKE v_uid::text || '/%'
        AND NEW.avatar_url NOT LIKE '%/storage/v1/object/public/avatars/' || v_uid::text || '/%') THEN
      RAISE EXCEPTION 'Percorso avatar non valido.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_service ON public.profiles;
CREATE TRIGGER guard_profile_self_service
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_service();
