-- 037_lobby_reconfirm_36h.sql
-- Migrazione A della #91 (la B — predicato del -3, starting_soon,
-- rimozione di `in_progress`, rami UI — e' un'altra lane e non si tocca).
--
-- 1. Riconferma: `lobby_participants.reconfirmed_at TIMESTAMPTZ NULL`,
--    scritta dall'utente via `reconfirm_lobby()` (SECURITY DEFINER). La
--    finestra 24h->30min sta nel DB, mai nel client. Chi non riconferma
--    resta iscritto: l'esclusione dal -3 e' della migrazione B.
--    Su `lobby_participants` mancavano policy e grant UPDATE (001/035):
--    policy own-row + guard che limita l'UPDATE diretto alla sola
--    `reconfirmed_at` in finestra (senza, la policy aprirebbe lo
--    spostamento di riga propria su un'altra lobby scavalcando il controllo
--    ban, che e' solo sull'INSERT).
-- 2. Aggancio check-in <-> partita: BEFORE INSERT su `check_ins`
--    (SECURITY DEFINER), solo se `NEW.lobby_id IS NULL`. Mai RAISE: se non
--    trova, resta NULL (walk-in senza riconferma continua a funzionare).
-- 3. Orizzonte "Vicine" 36h dentro `open_lobbies`, prima del LIMIT, con
--    indice parziale nuovo. DROP+CREATE -> grant ri-concessi nello stesso
--    file (trappola in docs/rpc.md).
-- Soglie confermate (commento #91 del 2026-11-18): finestra 24h->30min,
-- orizzonte vicine 36h. L'orizzonte di generazione (14 giorni) e' #92.

-- ================= 1. riconferma =================
ALTER TABLE public.lobby_participants
  ADD COLUMN IF NOT EXISTS reconfirmed_at TIMESTAMPTZ NULL;

-- Scrittura della riconferma: finestra valutata nel DB.
-- P0001 = fuori finestra; 42501 = non sei iscritto a questa lobby.
CREATE OR REPLACE FUNCTION public.reconfirm_lobby(p_lobby_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
BEGIN
  SELECT start_time INTO v_start
  FROM public.lobbies
  WHERE id = p_lobby_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Lobby inesistente' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (v_start - INTERVAL '24 hours' < NOW()
          AND NOW() < v_start - INTERVAL '30 minutes') THEN
    RAISE EXCEPTION 'Riconferma possibile solo tra 24 ore e 30 minuti prima dell''inizio'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.lobby_participants
  SET reconfirmed_at = NOW()
  WHERE lobby_id = p_lobby_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Non sei iscritto a questa lobby'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reconfirm_lobby(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconfirm_lobby(UUID) TO authenticated;

-- La via maestra e' la funzione sopra (finestra + errori dedicati); la
-- policy copre l'UPDATE diretto, limitato dal guard qui sotto.
CREATE POLICY "Users can reconfirm own participation" ON public.lobby_participants
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON public.lobby_participants TO authenticated;

-- L'UPDATE diretto puo' toccare solo `reconfirmed_at`, e solo in finestra:
-- senza, la policy own-row permetterebbe di spostare la propria riga su
-- un'altra lobby scavalcando `check_user_not_banned` (solo INSERT, 001).
CREATE OR REPLACE FUNCTION public.guard_participant_reconfirm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_start TIMESTAMPTZ;
BEGIN
  IF NEW.lobby_id IS DISTINCT FROM OLD.lobby_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'La partecipazione si sposta solo con esci + unisciti'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.reconfirmed_at IS DISTINCT FROM OLD.reconfirmed_at THEN
    SELECT start_time INTO v_start
    FROM public.lobbies
    WHERE id = NEW.lobby_id;
    IF v_start IS NULL
       OR NOT (v_start - INTERVAL '24 hours' < NOW()
               AND NOW() < v_start - INTERVAL '30 minutes') THEN
      RAISE EXCEPTION 'Riconferma possibile solo tra 24 ore e 30 minuti prima dell''inizio'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_participant_reconfirm ON public.lobby_participants;
CREATE TRIGGER trigger_guard_participant_reconfirm
BEFORE UPDATE ON public.lobby_participants
FOR EACH ROW
EXECUTE FUNCTION public.guard_participant_reconfirm();

-- ================= 2. aggancio check-in <-> partita =================
-- Mai il client: passerebbe una lobby_id arbitraria per schivare il karma
-- (migrazione B). Solo se NULL: stessa corte, lobby `open`, utente con
-- `reconfirmed_at` non nullo,
-- `start_time - 30min <= COALESCE(checked_in_at, now()) <= ends_at`
-- (036), la piu' vicina all'orario del check-in. Se non trova, resta NULL:
-- lo storico non si backfilla (ambiguo per costruzione, vedi #91).
CREATE OR REPLACE FUNCTION public.assign_check_in_lobby()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at TIMESTAMPTZ;
BEGIN
  IF NEW.lobby_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_at := COALESCE(NEW.checked_in_at, NOW());

  SELECT l.id INTO NEW.lobby_id
  FROM public.lobbies l
  JOIN public.lobby_participants lp
    ON lp.lobby_id = l.id
   AND lp.user_id = NEW.user_id
  WHERE l.court_id = NEW.court_id
    AND l.status = 'open'
    AND lp.reconfirmed_at IS NOT NULL
    AND l.start_time - INTERVAL '30 minutes' <= v_at
    AND v_at <= l.ends_at
  ORDER BY abs(extract(epoch from (l.start_time - v_at))) ASC
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_check_in_lobby ON public.check_ins;
CREATE TRIGGER trigger_assign_check_in_lobby
BEFORE INSERT ON public.check_ins
FOR EACH ROW
EXECUTE FUNCTION public.assign_check_in_lobby();

-- ================= 3. orizzonte 36h in open_lobbies =================
-- Il filtro sta nel WHERE, prima del LIMIT: altrimenti le 100 righe sono
-- gia' mangiate dalle occorrenze lontane (vedi #91 punto 2 e l'indice
-- sotto). Il drawer doppioni NON prende questo filtro (deve vedere le
-- future: e' il suo lavoro).
CREATE INDEX IF NOT EXISTS idx_lobbies_open_start
  ON public.lobbies (status, start_time)
  WHERE status = 'open';

DROP FUNCTION IF EXISTS public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE FUNCTION public.open_lobbies(
  p_sport TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_m DOUBLE PRECISION DEFAULT 15000
)
RETURNS TABLE (
  id uuid, court_id uuid, start_time timestamptz, max_players integer,
  status text, court_name text, court_sport text, participants_count bigint,
  sport text, duration_minutes integer, ends_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT l.id, l.court_id, l.start_time, l.max_players, l.status,
         c.name, c.sport, pc.cnt,
         l.sport, l.duration_minutes, l.ends_at
  FROM public.lobbies l
  JOIN public.courts c ON c.id = l.court_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.lobby_participants lp
    WHERE lp.lobby_id = l.id
  ) pc ON true,
  origin o
  WHERE l.status = 'open'
    -- #91: orizzonte "Vicine" 36h, prima del LIMIT.
    AND l.start_time < NOW() + INTERVAL '36 hours'
    -- #71: NULL = sport non specificato, visibile con qualunque filtro sport.
    AND (p_sport IS NULL OR c.sport IS NULL OR c.sport = 'multi'
         OR EXISTS (SELECT 1 FROM unnest(string_to_array(c.sport, ';')) t WHERE trim(t) = p_sport))
    -- Senza coordinate il filtro geo e' spento (compatibilita' con la 013).
    AND (p_lat IS NULL OR p_lng IS NULL
         OR ST_DWithin(c.location, o.g, COALESCE(p_radius_m, 15000)))
  ORDER BY
    -- Senza coordinate: stesso ordinamento della 013. Con coordinate: KNN
    -- per distanza (il CASE valuta un solo ramo, mai ST_Distance su NULL).
    CASE WHEN p_lat IS NULL OR p_lng IS NULL
      THEN EXTRACT(EPOCH FROM l.start_time)
      ELSE ST_Distance(c.location, o.g) END ASC,
    l.start_time ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobbies(TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
