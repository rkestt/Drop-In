-- 024_user_favorites.sql — Campi salvati (issue #22).
--
-- `public.user_favorites` mappa utente -> campo: la PK composita
-- (user_id, court_id) rende il toggle idempotente (doppio tap = una sola
-- riga, INSERT in conflitto invece di duplicati) e da' l'unicita' gratis
-- senza trigger.
--
-- Regola approved-only: un preferito si puo' creare solo su un campo con
-- `moderation_status = 'approved'` (subselect in WITH CHECK). Le corti
-- pending/rejected/duplicate restano non salvabili: evita di "prenotare"
-- visibilita' a contenuti mai moderati e di leakare l'esistenza di una
-- pending via insert-oracle (l'errore e' sempre un generico 42501).

CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, court_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_created
  ON public.user_favorites (user_id, created_at DESC);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can save approved courts" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can remove own favorites" ON public.user_favorites;

-- Ognuno vede solo le proprie righe (niente feed sociale sui salvati).
CREATE POLICY "Users can view own favorites"
  ON public.user_favorites
  FOR SELECT
  USING (user_id = auth.uid());

-- Salvataggio: solo righe proprie e solo su campi approvati.
CREATE POLICY "Users can save approved courts"
  ON public.user_favorites
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = court_id
        AND c.moderation_status = 'approved'
    )
  );

-- Rimozione: solo righe proprie. Nessuna policy UPDATE: il toggle e'
-- INSERT-or-DELETE, UPDATE non serve.
CREATE POLICY "Users can remove own favorites"
  ON public.user_favorites
  FOR DELETE
  USING (user_id = auth.uid());

-- Grant espliciti come il resto del repo (005 per le tabelle storiche, 010
-- per courts/court_submissions): niente UPDATE, niente accesso anon.
REVOKE ALL ON public.user_favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;
