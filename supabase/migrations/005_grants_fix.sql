-- Fix grants: tabelle create senza GRANT DML per anon/authenticated.
-- Le policy RLS esistono ma senza grant le query client falliscono con 42501.
-- Grant in lettura per tutti (browse-first), scrittura per authenticated.
-- Le policy RLS limitano comunque righe e operazioni.

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
