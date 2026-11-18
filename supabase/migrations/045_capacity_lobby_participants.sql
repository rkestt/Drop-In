-- 045_capacity_lobby_participants.sql
-- Chiude #92 (capienza dal DB): il "pieno" era solo client
-- (`lobby-card.tsx`/`lobby-detail.tsx`, `count >= max_players`).
-- Ora il join oltre capienza e' rifiutato dal DB, anche in concorrenza.
--
-- `SELECT max_players ... FOR UPDATE` sulla lobby serializza gli INSERT
-- concorrenti: il secondo aspetta il commit del primo e poi conta anche
-- la sua riga. Vale per tutte le lobby, non solo per le Occorrenze di Serie.
-- SECURITY DEFINER + search_path pinnato (lezioni #100/#102, file 040/043).

CREATE OR REPLACE FUNCTION public.check_lobby_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
  v_cnt INTEGER;
BEGIN
  SELECT max_players INTO v_max
  FROM public.lobbies
  WHERE id = NEW.lobby_id
  FOR UPDATE;

  -- Lobby inesistente: lascia fallire la FK, non inventare errori.
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.lobby_participants
  WHERE lobby_id = NEW.lobby_id;

  IF v_cnt >= v_max THEN
    RAISE EXCEPTION 'Lobby al completo (% partecipanti su % posti)', v_cnt, v_max
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_lobby_capacity ON public.lobby_participants;
CREATE TRIGGER trigger_check_lobby_capacity
BEFORE INSERT ON public.lobby_participants
FOR EACH ROW
EXECUTE FUNCTION public.check_lobby_capacity();
