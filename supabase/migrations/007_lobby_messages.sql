-- Lobby messages table for real-time chat
CREATE TABLE lobby_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast loading
CREATE INDEX idx_lobby_messages_lobby_created ON lobby_messages(lobby_id, created_at ASC);

-- Auto-delete messages when lobby is closed (after 24h)
CREATE OR REPLACE FUNCTION expire_lobby_messages()
RETURNS VOID AS $$
BEGIN
  DELETE FROM lobby_messages
  WHERE lobby_id IN (
    SELECT id FROM lobbies
    WHERE status = 'closed'
      AND updated_at < NOW() - INTERVAL '24 hours'
  );
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('expire-lobby-messages', '0 3 * * *', 'SELECT expire_lobby_messages()');

-- RLS
ALTER TABLE lobby_messages ENABLE ROW LEVEL SECURITY;

-- Only participants can read/write in a lobby
CREATE POLICY "Lobby participants can read messages" ON lobby_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.lobby_id = lobby_messages.lobby_id
        AND lp.user_id = auth.uid()
    )
  );

CREATE POLICY "Lobby participants can send messages" ON lobby_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.lobby_id = lobby_messages.lobby_id
        AND lp.user_id = auth.uid()
    )
  );