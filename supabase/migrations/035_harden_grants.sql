-- 035_harden_grants.sql
-- Chiude #84 (seconda parte): grant al minimo necessario.
--
-- Supabase assegna di default ALL (INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/
-- REFERENCES) su ogni tabella nuova in `public` ad `anon` e `authenticated`.
-- La RLS salva le righe, ma il privilegio resta: un errore di policy, una
-- tabella senza RLS o un `USING (true)` scritto male diventano scrivibili.
-- Qui si tiene solo cio' che l'app chiama davvero, verificato con:
--   grep -rn "\.from(\"<tabella>\")" app components lib
--
-- La scrittura RPC (submit_court, approve_court, ...) resta possibile:
-- gira in SECURITY DEFINER come owner, non col privilegio del chiamante.
--
-- Nota su `spatial_ref_sys` (PostGIS, RLS off, scrivibile da anon): la
-- tabella e' di proprieta' di `supabase_admin`, quindi una migrazione che
-- gira come `postgres` non puo' revocarne i privilegi (WARNING "no
-- privileges could be revoked"). Si sistema a livello di progetto con una
-- query una-tantum: vedi `docs/security.md`.
--
-- Idempotente: REVOKE/GRANT sono assoluti, ri-eseguibile.

-- --- tabelle di sola lettura pubblica -------------------------------------
REVOKE ALL ON public.courts FROM anon, authenticated;
GRANT SELECT ON public.courts TO anon, authenticated;

REVOKE ALL ON public.court_submissions FROM anon, authenticated;
GRANT SELECT ON public.court_submissions TO anon, authenticated;

REVOKE ALL ON public.court_rating_summary FROM anon, authenticated;
GRANT SELECT ON public.court_rating_summary TO anon, authenticated;

-- --- profiles: lettura pubblica, scrittura solo la propria riga -----------
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- --- check_ins: lettura pubblica, insert + checkout propri ---------------
REVOKE ALL ON public.check_ins FROM anon, authenticated;
GRANT SELECT ON public.check_ins TO anon, authenticated;
GRANT INSERT, UPDATE ON public.check_ins TO authenticated;

-- --- court_reports: lettura pubblica, insert proprio ---------------------
REVOKE ALL ON public.court_reports FROM anon, authenticated;
GRANT SELECT ON public.court_reports TO anon, authenticated;
GRANT INSERT ON public.court_reports TO authenticated;

-- --- lobbies: lettura pubblica, creazione e modifica della propria --------
-- UPDATE serve: la policy "Creator can update lobby" e' testata (blocco 29)
-- per il cambio `court_id`/`max_players` del creatore. DELETE resta fuori:
-- l'app non cancella lobby dal client (chiude il cron).
REVOKE ALL ON public.lobbies FROM anon, authenticated;
GRANT SELECT ON public.lobbies TO anon, authenticated;
GRANT INSERT, UPDATE ON public.lobbies TO authenticated;

-- --- lobby_participants: join/leave propri ------------------------------
REVOKE ALL ON public.lobby_participants FROM anon, authenticated;
GRANT SELECT ON public.lobby_participants TO anon, authenticated;
GRANT INSERT, DELETE ON public.lobby_participants TO authenticated;

-- --- court_reviews: invariato rispetto alla 033 (lettura anon) ----------
REVOKE ALL ON public.court_reviews FROM anon, authenticated;
GRANT SELECT ON public.court_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_reviews TO authenticated;

-- --- notifiche e push: mai anon ----------------------------------------
REVOKE ALL ON public.push_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.push_notifications TO authenticated;

REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- --- preferiti: solo authenticated (RLS own-rows) -----------------------
REVOKE ALL ON public.user_favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;

-- --- rate limit (034): nessun accesso client ----------------------------
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;
