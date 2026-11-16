-- 033_court_reviews.sql
-- Chiude #34: recensioni delle corti (DB layer only, nessuna UI, nessun app code).
--
-- `public.court_reviews`: una riga per coppia (utente, corte) — unique
-- (user_id, court_id), cosi' la UI fa upsert/edit invece di duplicati.
-- `user_id` referenzia `auth.users(id)` come `court_reports` in 001 (convenzione
-- del repo, non profiles). Nessun requisito di check-in: qualunque utente
-- autenticato puo' recensire (decisione presa, non vincolo tecnico).
-- `body` e' opzionale (NULL = solo stelle); stringa vuota o soli spazi NON
-- passa il check e va inviata come NULL.
--
-- Perche' una view e non una colonna denormalizzata su `courts`: media e
-- conteggio derivano sempre dalle righe reali (niente drift da trigger, niente
-- backfill, una sola fonte di verita'). La pagina della corte la legge con
-- `eq('court_id', id)`; `security_invoker = true` fa applicare la RLS
-- sottostante al chiamante, quindi l'aggregato non leaka le pending.
--
-- Cosa NON coperto: nessuna moderazione testuale (il body non e' filtrato),
-- nessuna interazione col karma.
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
-- + CREATE, CREATE OR REPLACE per funzione e view, REVOKE/GRANT finali.

CREATE TABLE IF NOT EXISTS public.court_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (body IS NULL OR (char_length(btrim(body)) BETWEEN 1 AND 500)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, court_id)
);

CREATE INDEX IF NOT EXISTS idx_court_reviews_court_created
  ON public.court_reviews (court_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_court_reviews_user
  ON public.court_reviews (user_id);

ALTER TABLE public.court_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews of approved courts" ON public.court_reviews;
DROP POLICY IF EXISTS "Authenticated users can review approved courts" ON public.court_reviews;
DROP POLICY IF EXISTS "Authors can edit own reviews on approved courts" ON public.court_reviews;
DROP POLICY IF EXISTS "Authors can delete own reviews" ON public.court_reviews;

-- Lettura pubblica sulle corti approvate; l'autore rivede sempre la propria
-- riga anche se la corte viene poi de-approvata.
CREATE POLICY "Anyone can read reviews of approved courts"
  ON public.court_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = court_id
        AND c.moderation_status = 'approved'
    )
    OR user_id = auth.uid()
  );

-- Scrittura: solo righe proprie e solo su corti approvate. Il 42501 generico
-- su pending/rejected/duplicate e' intenzionale: niente insert-oracle sullo
-- stato di moderazione.
CREATE POLICY "Authenticated users can review approved courts"
  ON public.court_reviews
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = court_id
        AND c.moderation_status = 'approved'
    )
  );

CREATE POLICY "Authors can edit own reviews on approved courts"
  ON public.court_reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = court_id
        AND c.moderation_status = 'approved'
    )
  );

CREATE POLICY "Authors can delete own reviews"
  ON public.court_reviews
  FOR DELETE
  USING (user_id = auth.uid());

-- Guard di immutabilita' (stesso pattern di restrict_push_notifications_update
-- in 029/028): id, court_id, user_id e created_at non cambiano mai via UPDATE
-- utente; solo service_role (o sessioni senza claim JWT: psql/cron come
-- postgres) puo' toccarli per manutenzione.
CREATE OR REPLACE FUNCTION restrict_court_reviews_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');

  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.court_id IS DISTINCT FROM OLD.court_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'court_reviews: solo rating e body modificabili';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_court_reviews_update
  ON court_reviews;

CREATE TRIGGER trg_restrict_court_reviews_update
  BEFORE UPDATE ON court_reviews
  FOR EACH ROW
  EXECUTE FUNCTION restrict_court_reviews_update();

-- Aggregato pubblico per la pagina della corte: media arrotondata a 1
-- decimale, conteggio, ultima recensione. Una riga per corte recensita.
CREATE OR REPLACE VIEW public.court_rating_summary
WITH (security_invoker = true)
AS
SELECT
  court_id,
  round(avg(rating), 1) AS average,
  count(*)::int AS count,
  max(created_at) AS last_created_at
FROM public.court_reviews
GROUP BY court_id;

-- Grant espliciti come il resto del repo (024 per i preferiti): anon legge
-- solo recensioni e aggregato, authenticated scrive solo le proprie righe.
REVOKE ALL ON public.court_reviews FROM anon, authenticated;
GRANT SELECT ON public.court_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_reviews TO authenticated;
GRANT ALL ON public.court_reviews TO service_role;
REVOKE ALL ON public.court_rating_summary FROM anon, authenticated;
GRANT SELECT ON public.court_rating_summary TO anon, authenticated;
