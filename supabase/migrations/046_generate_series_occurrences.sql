-- 046_generate_series_occurrences.sql
-- Chiude #92 (generazione Occorrenze): cron notturno con orizzonte mobile
-- di 14 giorni (mai generazione lazy: la RLS INSERT impone auth e due
-- lettori duplicherebbero).
--
-- Regole (decisione @oracle su #92):
-- - ora = `time_of_day` letta nel fuso del campo
--   (`(data + ora)::timestamp AT TIME ZONE 'Europe/Rome'`); mai aritmetica
--   UTC ingenua su `time_of_day`. Il pattern IMMUTABLE/UTC della 036 non si
--   applica qui: e' ora locale vera (test sui cambi di marzo/ottobre in
--   `tests/rls/assertions.sql`, blocco 57).
-- - Idempotenza: `INSERT ... ON CONFLICT (series_id, start_time) DO NOTHING`.
-- - Skip senza errori: data passata; slot che si sovrappone a una lobby
--   `open` sullo stesso campo (il generatore non crea mai sopra una partita
--   esistente: singola o di un'altra Serie); corte non `active`/`approved`
--   (una Serie su corte cattiva non deve abortire il batch notturno).
-- - `creator_id`/`sport`/`duration_minutes`/`max_players` copiati dalla Serie
--   al momento della generazione; modifiche successive non retroattive
--   (le Occorrenze generate sono partite vere).
-- - Serie disattivata (`active = false`): saltata; le Occorrenze gia'
--   generate restano (fuori 36h invisibili, il cron le chiude). Serie
--   cancellata: `SET NULL`, diventano lobby singole. Il generatore non
--   cancella mai nulla e non tocca mai `lobby_participants` ne' `check_ins`:
--   le Occorrenze nascono con zero partecipanti, nessuna Conferma implicita
--   (altrimenti -3 a chi non riconferma qualcosa che non ha mai deciso).
--
-- `p_now` esiste solo per i test (blocco 57: weekend DST di marzo/ottobre);
-- il cron chiama senza argomenti (= NOW()). SECURITY DEFINER + search_path
-- pinnato (lezioni #100/#102). Esecuzione riservata al server (cron):
-- nessun EXECUTE a `anon`/`authenticated`.
--
-- Addendum #92 (materializzazione immediata): il corpo per-Serie vive in
-- `generate_series_one` (nessun grant), richiamata sia dal batch notturno
-- sia — via `materialize_series`, 047 — dal creatore subito dopo l'INSERT
-- della Serie. Doppio runner innocuo: entrambi fanno
-- `INSERT ... ON CONFLICT (series_id, start_time) DO NOTHING`.

CREATE OR REPLACE FUNCTION public.generate_series_one(p_series_id UUID, p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  v_now TIMESTAMPTZ := COALESCE(p_now, NOW());
  v_base DATE := ((COALESCE(p_now, NOW())) AT TIME ZONE 'Europe/Rome')::date;
  v_day DATE;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_n INTEGER;
  v_inserted INTEGER := 0;
  i INTEGER;
BEGIN
  SELECT * INTO s FROM public.lobby_series WHERE id = p_series_id;

  -- Serie inesistente o disattivata: zero righe, nessun errore.
  IF NOT FOUND OR NOT s.active THEN
    RETURN 0;
  END IF;

  -- Corte inutilizzabile: skip, il batch continua.
  IF NOT EXISTS (
    SELECT 1 FROM public.courts c
    WHERE c.id = s.court_id
      AND c.status = 'active'
      AND c.moderation_status = 'approved'
  ) THEN
    RETURN 0;
  END IF;

  FOR i IN 0..13 LOOP
    v_day := v_base + i;
    IF EXTRACT(ISODOW FROM v_day)::SMALLINT <> s.weekday THEN
      CONTINUE;
    END IF;

    -- Ora locale del campo nel fuso corretto (DST rispettata).
    v_start := (v_day + s.time_of_day)::timestamp AT TIME ZONE 'Europe/Rome';

    IF v_start <= v_now THEN
      CONTINUE;
    END IF;
    IF v_start > v_now + INTERVAL '14 days' THEN
      CONTINUE;
    END IF;

    v_end := v_start + make_interval(mins => s.duration_minutes);

    -- Mai sopra una partita esistente sullo stesso campo (singola o
    -- Occorrenza di un'altra Serie). Intervalli semiaperti [inizio, fine)
    -- come il drawer doppioni (`lib/lobby/overlap.ts`).
    IF EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.court_id = s.court_id
        AND l.status = 'open'
        AND l.start_time < v_end
        AND l.ends_at > v_start
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.lobbies
      (court_id, creator_id, start_time, max_players, status, sport, duration_minutes, series_id)
    VALUES
      (s.court_id, s.creator_id, v_start, s.max_players, 'open', s.sport, s.duration_minutes, s.id)
    ON CONFLICT (series_id, start_time) DO NOTHING;

    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_inserted := v_inserted + v_n;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_series_one(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_series_occurrences(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  v_n INTEGER;
  v_inserted INTEGER := 0;
BEGIN
  FOR s IN SELECT id FROM public.lobby_series WHERE active LOOP
    SELECT public.generate_series_one(s.id, COALESCE(p_now, NOW())) INTO v_n;
    v_inserted := v_inserted + v_n;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_series_occurrences(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('generate-series-occurrences', '30 2 * * *', 'SELECT public.generate_series_occurrences()');
