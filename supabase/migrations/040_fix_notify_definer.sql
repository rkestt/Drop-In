-- 040_fix_notify_definer.sql
-- P0 #100: nessuno poteva unirsi alla lobby di un altro. Il trigger
-- `notify_participant_joined` (002) e' SECURITY INVOKER e inserisce in
-- `push_notifications`: la 035 revoca INSERT su quella tabella ad
-- `authenticated`, quindi il join di un non-creatore moriva con
-- `permission denied`, annullando l'INSERT che l'aveva scatenato.
-- La regressione era invisibile perche' nessun test faceva il join con i
-- permessi del client (blocco RLS nuovo in coda ad assertions.sql).
--
-- Correzione: entrambe le funzioni di notifica diventano SECURITY DEFINER
-- con `SET search_path = public` (stessa forma delle altre: 027, 037-039),
-- corpo invariato. `CREATE OR REPLACE` conserva trigger agganciati
-- (`trigger_notify_participant_joined`, 002) e job del cron, che chiamano
-- per nome.
--
-- `notify_lobby_starting_soon` era invocata solo dal cron (come postgres:
-- innocua), ma fragile alla prima chiamata manuale; si allinea subito, con
-- dentro il filtro `reconfirmed_at` della 038 (il REPLACE riscrive tutto il
-- corpo, copiarlo dalla 038 e' obbligatorio).
--
-- `notify_user` (001) resta INVOKER di proposito: e' chiamata solo da
-- funzioni DEFINER (030) e non ha chiamanti client; farla DEFINER senza
-- revocare l'EXECUTE pubblico aprirebbe un oracolo di notifiche
-- arbitrarie. Da chiamata non privilegiata fallisce (fail-safe, visibile).

-- ================= participant_joined: corpo identico alla 002 =================
CREATE OR REPLACE FUNCTION public.notify_participant_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lobby_creator_id UUID;
  participant_nickname TEXT;
  court_name TEXT;
BEGIN
  -- Get the lobby creator and court name
  SELECT l.creator_id, c.name
  INTO lobby_creator_id, court_name
  FROM lobbies l
  JOIN courts c ON c.id = l.court_id
  WHERE l.id = NEW.lobby_id;

  -- Get the joining user's nickname
  SELECT nickname INTO participant_nickname
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Don't notify if the joiner is the creator themselves
  IF NEW.user_id != lobby_creator_id THEN
    INSERT INTO push_notifications (user_id, title, body, data)
    VALUES (
      lobby_creator_id,
      'Nuovo partecipante!',
      COALESCE(participant_nickname, 'Un giocatore') || ' si è unito alla tua lobby a ' || COALESCE(court_name, 'un campo'),
      jsonb_build_object(
        'type', 'participant_joined',
        'lobby_id', NEW.lobby_id,
        'user_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ================= starting_soon: corpo della 038, solo DEFINER in piu' =================
CREATE OR REPLACE FUNCTION notify_lobby_starting_soon()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO push_notifications (user_id, title, body, data)
  SELECT
    lp.user_id,
    'La lobby sta per iniziare!',
    'La lobby al campo ' || c.name || ' inizia tra 15 minuti.',
    jsonb_build_object(
      'type', 'lobby_starting_soon',
      'lobby_id', l.id,
      'court_id', l.court_id,
      'start_time', l.start_time
    )
  FROM lobbies l
  JOIN courts c ON c.id = l.court_id
  JOIN lobby_participants lp ON lp.lobby_id = l.id
  WHERE l.status = 'open'
    AND l.start_time > NOW() + INTERVAL '13 minutes'
    AND l.start_time < NOW() + INTERVAL '17 minutes'
    -- #91: chi non ha riconfermato e' contato fuori, non lo si avvisa.
    AND lp.reconfirmed_at IS NOT NULL
    AND NOT EXISTS (
      -- Avoid duplicate notifications already sent
      SELECT 1 FROM push_notifications pn
      WHERE pn.user_id = lp.user_id
        AND pn.data->>'type' = 'lobby_starting_soon'
        AND pn.data->>'lobby_id' = l.id::text
    );
END;
$$;
