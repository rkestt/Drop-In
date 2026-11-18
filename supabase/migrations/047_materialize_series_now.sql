-- 047_materialize_series_now.sql
-- Chiude #92 (addendum, decisione @oracle vincolante): materializzazione
-- immediata della Serie appena dichiarata.
--
-- Motivo per uso reale: l'organizzatore dichiara "il giovedi' alle 20" il
-- giovedi' pomeriggio e attiva "ripetibile" nello stesso gesto. Senza
-- materializzazione immediata la Serie creata oggi resta invisibile stasera
-- (cron alle 02:30), non ci si puo' unire all'Occorrenza di stasera (la
-- Conferma richiede una riga `lobbies`), e "Le mie serie" non ha alcuna
-- prossima Occorrenza da mostrare.
--
-- Forma: `materialize_series(p_series_id)` con grant ad `authenticated`,
-- solo sulla propria Serie (gate esplicito su `creator_id = auth.uid()`,
-- mai i partecipanti: la regola e' del creatore, scelta (a)). La logica di
-- generazione resta una sola (`generate_series_one`, 046): stesse regole
-- (fuso Europe/Rome, skip passato/sovrapposizione/corte non approvata,
-- copia campi, ON CONFLICT DO NOTHING, zero scritture su
-- `lobby_participants`/`check_ins`). Doppio runner innocuo: cron e wrapper
-- sono entrambi no-op al rerun, mai errore. Abuso autolimitato: il wrapper
-- materializza una sola Serie e solo al suo creatore.
-- Chiamata dalla server action subito dopo l'INSERT della Serie; nessuna
-- modifica a RLS/policy esistenti. SECURITY DEFINER + search_path pinnato
-- (lezioni #100/#102).

CREATE OR REPLACE FUNCTION public.materialize_series(p_series_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lobby_series
    WHERE id = p_series_id AND creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Solo il creatore puo'' materializzare la serie'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN public.generate_series_one(p_series_id, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_series(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_series(UUID) TO authenticated;
