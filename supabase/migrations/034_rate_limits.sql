-- 034_rate_limits.sql
-- Chiude #84 (prima parte): rate limit per-utente lato database sulle
-- scritture che un client puo' fare direttamente su PostgREST.
--
-- Perche' nel database e non nel middleware: il client parla con Supabase
-- direttamente (`supabase.from(...).insert()`), quindi un limite applicativo
-- in Next.js sarebbe aggirabile chiamando la REST API con lo stesso JWT.
-- Il trigger e' l'unico punto che vede ogni riga, in qualunque modo arrivi.
--
-- `submit_court` aveva gia' il suo limite (1/ora, 031). Qui il limite
-- generico per le altre scritture, con una tabella di eventi invece di
-- contatori denormalizzati: nessun drift, cleanup via pg_cron.
--
-- Limiti scelti (persone, non bot):
--   report            5 / ora    (segnalazioni: 5 campi rotti in un'ora sono tanti)
--   lobby             5 / ora    (creare partite)
--   lobby_join       30 / ora    (entrare/uscire da lobby; join+leave =
--                                 2 righe di eventi solo per il join)
--   review           10 / ora    (una recensione per corte, edit non conta)
--   check_in         20 / ora    (il cooldown 5 min per corte resta; questo
--                                 ferma il giro di 30 campi diversi)
--
-- Cosa NON copre: upload foto (il trigger su storage.objects e' di
-- competenza dello schema storage; il percorso foto e' gia' vincolato a
-- `<uid>/…` e ogni foto passa da una submission, 1/ora) e traffico anon
-- (anon non ha INSERT su nessuna di queste tabelle, vedi RLS).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY/TRIGGER/FUNCTION IF
-- EXISTS prima dei CREATE, CREATE OR REPLACE per le funzioni, cron.schedule
-- con lo stesso nome sostituisce il job.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  subject UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (bucket, subject, created_at DESC);

-- Nessuna policy: la tabella si legge/scrive solo dalle funzioni
-- SECURITY DEFINER qui sotto. Abilitare la RLS senza policy significa
-- "chiusa per anon/authenticated", che e' esattamente il contratto.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;

-- Conta gli eventi della finestra e, se sotto soglia, registra quello nuovo.
-- Il lock consultivo serializza il check-then-insert per (bucket, utente):
-- senza, due richieste concorrenti leggono lo stesso conteggio.
-- `p_message` e' il testo italiano mostrato dal client sull'errore P0001.
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_bucket TEXT,
  p_limit INTEGER,
  p_window INTERVAL,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_count INTEGER;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'Limite non valido per %', p_bucket;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Sessioni senza claim (psql, cron, service_role): niente da limitare.
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rate_limit:' || p_bucket || ':' || v_uid::text));

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE bucket = p_bucket
    AND subject = v_uid
    AND created_at > now() - p_window;

  IF v_count >= p_limit THEN
    RAISE EXCEPTION '%', p_message USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limit_events (bucket, subject) VALUES (p_bucket, v_uid);
END;
$$;

-- Solo interna: i client non devono poter inventare bucket o svuotare la
-- propria finestra chiamando l'RPC.
REVOKE ALL ON FUNCTION public.enforce_rate_limit(TEXT, INTEGER, INTERVAL, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(TEXT, INTEGER, INTERVAL, TEXT)
  TO service_role;

-- Trigger per tabella. SECURITY DEFINER per poter leggere/scrivere la
-- tabella eventi anche quando la riga arriva da `authenticated`.
CREATE OR REPLACE FUNCTION public.guard_rate_limit_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'report', 5, INTERVAL '1 hour',
    'Hai inviato troppe segnalazioni nell''ultima ora. Riprova più tardi.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_lobby()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'lobby', 5, INTERVAL '1 hour',
    'Hai creato troppe lobby nell''ultima ora. Riprova più tardi.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_lobby_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'lobby_join', 30, INTERVAL '1 hour',
    'Troppi ingressi nelle lobby nell''ultima ora. Riprova più tardi.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'review', 10, INTERVAL '1 hour',
    'Hai scritto troppe recensioni nell''ultima ora. Riprova più tardi.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_rate_limit_check_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit(
    'check_in', 20, INTERVAL '1 hour',
    'Troppi check-in nell''ultima ora. Riprova più tardi.');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_rate_limit_report() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_rate_limit_lobby() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_rate_limit_lobby_join() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_rate_limit_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_rate_limit_check_in() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rate_limit_report ON public.court_reports;
CREATE TRIGGER trg_rate_limit_report
  BEFORE INSERT ON public.court_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_rate_limit_report();

DROP TRIGGER IF EXISTS trg_rate_limit_lobby ON public.lobbies;
CREATE TRIGGER trg_rate_limit_lobby
  BEFORE INSERT ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.guard_rate_limit_lobby();

DROP TRIGGER IF EXISTS trg_rate_limit_lobby_join ON public.lobby_participants;
CREATE TRIGGER trg_rate_limit_lobby_join
  BEFORE INSERT ON public.lobby_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_rate_limit_lobby_join();

DROP TRIGGER IF EXISTS trg_rate_limit_review ON public.court_reviews;
CREATE TRIGGER trg_rate_limit_review
  BEFORE INSERT ON public.court_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_rate_limit_review();

DROP TRIGGER IF EXISTS trg_rate_limit_check_in ON public.check_ins;
CREATE TRIGGER trg_rate_limit_check_in
  BEFORE INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.guard_rate_limit_check_in();

-- Anti-spam minimo sul testo libero delle proposte community: un nome o un
-- indirizzo con un link e' spam per definizione (il campo e' un nome di
-- campetto, non una bacheca). Solo righe con `submitted_by` (community):
-- il seed OSM e la moderazione restano intatti.
CREATE OR REPLACE FUNCTION public.guard_court_text_spam()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.submitted_by IS NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.name, '') ~* '(https?://|www\.|t\.me/|bit\.ly/)'
     OR COALESCE(NEW.address, '') ~* '(https?://|www\.|t\.me/|bit\.ly/)' THEN
    RAISE EXCEPTION 'Niente link nel nome o nell''indirizzo del campo.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_court_text_spam ON public.courts;
CREATE TRIGGER trg_guard_court_text_spam
  BEFORE INSERT OR UPDATE OF name, address ON public.courts
  FOR EACH ROW EXECUTE FUNCTION public.guard_court_text_spam();

-- Pulizia: 7 giorni bastano per qualunque finestra qui sopra.
SELECT cron.schedule(
  'rate-limit-cleanup',
  '30 3 * * *',
  $$DELETE FROM public.rate_limit_events WHERE created_at < now() - INTERVAL '7 days'$$
);
