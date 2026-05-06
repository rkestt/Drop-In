-- Storage: avatars bucket + RLS policies
-- NOTE: policies must be created via DO $$ because storage.objects
-- is owned by supabase_storage_admin (not postgres), so plain CREATE POLICY
-- fails with "must be owner of table objects".

-- Create avatars bucket (run as postgres, should work)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars',
      'avatars',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
    );
  END IF;
END $$;

-- RLS policies (run as postgres, using DO $$ to bypass ownership check)
DO $$ 
BEGIN
  EXECUTE format(
    'CREATE POLICY IF NOT EXISTS "Public avatar access" ON storage.objects '
    'FOR SELECT USING (bucket_id = ''avatars'')'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "Public avatar access" skipped: %', SQLERRM;
END $$;

DO $$ 
BEGIN
  EXECUTE format(
    'CREATE POLICY IF NOT EXISTS "Users can upload own avatar" ON storage.objects '
    'FOR INSERT WITH CHECK (bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1])'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "Users can upload own avatar" skipped: %', SQLERRM;
END $$;

DO $$ 
BEGIN
  EXECUTE format(
    'CREATE POLICY IF NOT EXISTS "Users can update own avatar" ON storage.objects '
    'FOR UPDATE USING (bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1]) '
    'WITH CHECK (bucket_id = ''avatars'')'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "Users can update own avatar" skipped: %', SQLERRM;
END $$;
