-- Migration 004: Fix Supabase linter errors
-- Addresses: security_definer_view and rls_disabled_in_public

-- 1. Drop the problematic SECURITY DEFINER view if it exists
-- The view public_lobby_participants should not exist with SECURITY DEFINER
-- If needed, it should be recreated as a regular view or function with proper permissions
DROP VIEW IF EXISTS public.public_lobby_participants;

-- 2. Create extensions schema for PostGIS tables
-- This moves PostGIS system tables out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move PostGIS extension to extensions schema
-- Note: This requires PostGIS to be reinstalled in the new schema
-- For existing installations, we'll handle permissions instead

-- Grant usage on extensions schema to service_role only
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- If spatial_ref_sys exists in public schema, move it or restrict access
-- spatial_ref_sys is a PostGIS system table that should not be publicly accessible
DO $$
BEGIN
  -- Check if spatial_ref_sys exists in public schema
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'spatial_ref_sys'
  ) THEN
    -- Revoke all public access to spatial_ref_sys
    REVOKE ALL ON public.spatial_ref_sys FROM PUBLIC;
    REVOKE ALL ON public.spatial_ref_sys FROM anon;
    REVOKE ALL ON public.spatial_ref_sys FROM authenticated;
    
    -- Grant only necessary permissions to service_role
    GRANT SELECT ON public.spatial_ref_sys TO service_role;
  END IF;
END $$;

-- Alternative: If you want to keep PostGIS in public schema but secure it
-- The above DO block handles this by revoking public access

-- Note: If you need to recreate the lobby_participants view without SECURITY DEFINER:
-- CREATE OR REPLACE VIEW public.lobby_participants_view AS
-- SELECT lp.*, p.nickname, p.avatar_url
-- FROM lobby_participants lp
-- JOIN profiles p ON p.user_id = lp.user_id;
-- 
-- Then set up proper RLS policies on the view or use the underlying table directly
