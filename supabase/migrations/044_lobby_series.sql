-- 044_lobby_series.sql
-- Chiude #92 (parte dati, Serie/Occorrenze): la Serie (regola di ripetizione)
-- e il legame Occorrenza -> Serie.
--
-- Vocabolario Glossario solo nei commenti (Serie, Occorrenza, Conferma):
-- lo schema resta in inglese come il resto del database.
--
-- Decisione vincolante (commento @oracle su #92, scelta (a)): chi ha
-- Confermato un'Occorrenza puo' chiudere la singola Occorrenza
-- (`status open -> closed`); la Serie (giorno, ora, campo, attiva o no)
-- resta del creatore. `creator_id` e' solo provenienza (stessa convenzione
-- della 041: NULL = account eliminato). Kill-switch orfani: se `creator_id`
-- e' NULL, qualunque partecipante di un'Occorrenza degli ultimi 28 giorni
-- puo' mettere `active = false`, cosi' le Serie sopravvivono al ricambio
-- degli organizzatori (vincolo spring.md voce 13: 3-5 serie vive per polo).
--
-- - `lobbies.series_id` + UNIQUE (series_id, start_time): i NULL non
--   confliggono in PG, le lobby singole non sono toccate. L'unique crea
--   gia' l'indice; nessun altro indice (l'orizzonte 36h usa
--   `idx_lobbies_open_start` della 037).
-- - Le Occorrenze generate sono lobby normali: `open_lobbies` (037),
--   `phase.ts` e la chiusura su `ends_at` (036) restano invariati.
-- - Tutte le funzioni/trigger nuovi: SECURITY DEFINER + search_path pinnato
--   (lezioni #100/#102, file 040/043).

-- ================= Serie =================
CREATE TABLE public.lobby_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts (id) ON DELETE CASCADE,
  creator_id UUID NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  time_of_day TIME NOT NULL,
  sport TEXT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  max_players INTEGER NOT NULL DEFAULT 10 CHECK (max_players BETWEEN 1 AND 50),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.lobby_series IS
  'Serie (#92): regola di ripetizione "il giovedi'' alle 20 al campo X". Le Occorrenze sono righe `lobbies` con series_id valorizzato.';
COMMENT ON COLUMN public.lobby_series.creator_id IS
  'Solo provenienza (#92, come la 041): la Serie resta modificabile al creatore, ma le Occorrenze si chiudono dai partecipanti. NULL = creatore eliminato.';
COMMENT ON COLUMN public.lobby_series.weekday IS
  'Giorno ISO 1=lunedi'' .. 7=domenica.';
COMMENT ON COLUMN public.lobby_series.time_of_day IS
  'Ora locale del campo (fuso Europe/Rome letto dal generatore 046, mai aritmetica UTC ingenua).';

CREATE TRIGGER trigger_lobby_series_updated_at
BEFORE UPDATE ON public.lobby_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ================= Occorrenze: legame verso le lobby =================
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS series_id UUID NULL
    REFERENCES public.lobby_series (id) ON DELETE SET NULL;

-- Serie cancellata -> le Occorrenze diventano lobby singole (non si cancella mai nulla).
ALTER TABLE public.lobbies
  DROP CONSTRAINT IF EXISTS lobbies_series_id_start_time_unique;
ALTER TABLE public.lobbies
  ADD CONSTRAINT lobbies_series_id_start_time_unique
  UNIQUE (series_id, start_time);

-- ================= RLS Serie (mirror 001/035) =================
ALTER TABLE public.lobby_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lobby series are viewable by everyone" ON public.lobby_series
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create series" ON public.lobby_series
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update series" ON public.lobby_series
  FOR UPDATE USING (auth.uid() = creator_id);

-- Kill-switch orfani: Serie senza creatore disattivabile da chi ha
-- Confermato un'Occorrenza degli ultimi 28 giorni già iniziata
-- (`start_time <= NOW()`: una sola occorrenza futura non basta, è il
-- contratto "partecipante di un'occorrenza degli ultimi 28 giorni").
-- Il guard qui sotto limita il cambio al solo `active true -> false`.
CREATE POLICY "Participants can deactivate orphaned series" ON public.lobby_series
  FOR UPDATE
  USING (
    creator_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.lobbies l
      JOIN public.lobby_participants lp ON lp.lobby_id = l.id
      WHERE l.series_id = lobby_series.id
        AND lp.user_id = auth.uid()
        AND l.start_time > NOW() - INTERVAL '28 days'
        AND l.start_time <= NOW()
    )
  )
  WITH CHECK (creator_id IS NULL AND active = false);

CREATE POLICY "Creator can delete series" ON public.lobby_series
  FOR DELETE USING (auth.uid() = creator_id);

REVOKE ALL ON public.lobby_series FROM anon, authenticated;
GRANT SELECT ON public.lobby_series TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lobby_series TO authenticated;

-- Guard stile `guard_participant_reconfirm` (037): il creatore cambia la
-- regola a piacere (ma mai `creator_id`: provenienza immutabile, vedi sopra);
-- un non-creatore puo' solo disattivare una Serie orfana
-- (`active true -> false`), nient'altro.
CREATE OR REPLACE FUNCTION public.guard_lobby_series_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- Nessuna sessione utente (cascate FK come il SET NULL della 041,
    -- service_role): la RLS non passa di qui (bypass) e i gate sotto restano
    -- per le sessioni con claim. Senza, cancellare un utente morirebbe sul
    -- SET NULL in cascata (visto dal blocco 56 di tests/rls).
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.creator_id THEN
    -- `creator_id` e' provenienza immutabile (#92): il creatore cambia la
    -- regola a piacere ma non puo' cedere la serie (né auto-orfanizzarla a
    -- NULL, perdendo il controllo). Stesso stile dei check orfani sotto.
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      RAISE EXCEPTION 'Il creatore della serie non si puo'' cambiare'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.creator_id IS NOT NULL THEN
    RAISE EXCEPTION 'Solo il creatore puo'' modificare la serie'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.active IS DISTINCT FROM TRUE OR NEW.active IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Su una serie orfana si puo'' solo disattivare (active true -> false)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.court_id IS DISTINCT FROM OLD.court_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.weekday IS DISTINCT FROM OLD.weekday
     OR NEW.time_of_day IS DISTINCT FROM OLD.time_of_day
     OR NEW.sport IS DISTINCT FROM OLD.sport
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.max_players IS DISTINCT FROM OLD.max_players THEN
    RAISE EXCEPTION 'Su una serie orfana si puo'' solo disattivare (active true -> false)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_lobby_series_update ON public.lobby_series;
CREATE TRIGGER trigger_guard_lobby_series_update
BEFORE UPDATE ON public.lobby_series
FOR EACH ROW
EXECUTE FUNCTION public.guard_lobby_series_update();

-- ================= Occorrenze: chiusura dai partecipanti =================
-- Policy 001 ("Creator can update lobby") invariata: il creatore resta
-- libero sulle proprie Occorrenze. Questa apre il solo spegnimento ai
-- partecipanti; il guard limita il cambio a `status open -> closed`
-- (qualsiasi altro tocco resta del creatore). Il cron chiude come postgres
-- (bypassa RLS) e passa dal guard come spegnimento lecito.
CREATE POLICY "Participants can close series occurrence" ON public.lobbies
  FOR UPDATE
  USING (
    series_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.lobby_participants lp
      WHERE lp.lobby_id = lobbies.id
        AND lp.user_id = auth.uid()
    )
  );

-- Grant UPDATE su `lobbies` esiste gia' (035): nessun grant nuovo qui.
CREATE OR REPLACE FUNCTION public.guard_series_occurrence_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lobby singole: invariato (policy 001).
  IF OLD.series_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    -- Nessuna sessione utente (cron che chiude, cascate FK della 041,
    -- service_role): la RLS non passa di qui (bypass) e i gate sotto restano
    -- per le sessioni con claim.
    RETURN NEW;
  END IF;

  -- Il creatore resta libero sulle Occorrenze della propria Serie.
  IF auth.uid() = OLD.creator_id THEN
    RETURN NEW;
  END IF;

  -- Via del partecipante: solo spegnimento, nient'altro.
  -- `updated_at` escluso dal confronto: lo riscrive dopo
  -- `trigger_lobbies_updated_at` (001), che scatta dopo questo guard
  -- (ordine alfabetico dei trigger).
  IF OLD.status IS DISTINCT FROM 'open' OR NEW.status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'Su un''occorrenza altrui si puo'' solo chiudere (open -> closed)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.court_id IS DISTINCT FROM OLD.court_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.max_players IS DISTINCT FROM OLD.max_players
     OR NEW.sport IS DISTINCT FROM OLD.sport
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.series_id IS DISTINCT FROM OLD.series_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Su un''occorrenza altrui si puo'' solo chiudere (open -> closed)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_series_occurrence_close ON public.lobbies;
CREATE TRIGGER trigger_guard_series_occurrence_close
BEFORE UPDATE ON public.lobbies
FOR EACH ROW
EXECUTE FUNCTION public.guard_series_occurrence_close();
