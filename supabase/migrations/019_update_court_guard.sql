-- 019_update_court_guard.sql
-- Chiude #57: la 012 aveva solo trigger BEFORE INSERT su lobbies/check_ins,
-- quindi un UPDATE poteva spostare una riga esistente su una corte
-- pending/rejected (visibilita' filtrata ad arte + check-in su corte nascosta).
-- Ora require_approved_court() (012, invariata) copre anche gli UPDATE di
-- court_id. Il WHEN evita di scattare sugli UPDATE che non toccano court_id;
-- a parita' di valore la riga resta dov'e'.
-- Nomi nello stile esistente (require_approved_court_<tabella> + _update).

DROP TRIGGER IF EXISTS require_approved_court_lobbies_update ON public.lobbies;
CREATE TRIGGER require_approved_court_lobbies_update
  BEFORE UPDATE OF court_id ON public.lobbies
  FOR EACH ROW
  WHEN (NEW.court_id IS DISTINCT FROM OLD.court_id)
  EXECUTE FUNCTION public.require_approved_court();

DROP TRIGGER IF EXISTS require_approved_court_check_ins_update ON public.check_ins;
CREATE TRIGGER require_approved_court_check_ins_update
  BEFORE UPDATE OF court_id ON public.check_ins
  FOR EACH ROW
  WHEN (NEW.court_id IS DISTINCT FROM OLD.court_id)
  EXECUTE FUNCTION public.require_approved_court();
