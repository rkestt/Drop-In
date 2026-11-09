-- 014_court_photo_freeze.sql
-- Dopo l'approvazione la foto di una corte e' immutabile per il proponente:
-- UPDATE e DELETE su storage.objects sono bloccati quando il path e' referenziato
-- da una corte approved. Solo service_role/postgres (bypass RLS) puo' intervenire.
--
-- Rollback: ricreare le due policy nella forma della 010, poi DROP INDEX:
--   DROP POLICY IF EXISTS court_photos_update ON storage.objects;
--   CREATE POLICY court_photos_update ON storage.objects
--     FOR UPDATE USING (bucket_id = 'court-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
--   DROP POLICY IF EXISTS court_photos_delete ON storage.objects;
--   CREATE POLICY court_photos_delete ON storage.objects
--     FOR DELETE USING (bucket_id = 'court-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
--   DROP INDEX IF EXISTS public.idx_courts_photo_path;

CREATE INDEX IF NOT EXISTS idx_courts_photo_path
  ON public.courts(photo_path) WHERE photo_path IS NOT NULL;

DROP POLICY IF EXISTS court_photos_update ON storage.objects;
CREATE POLICY court_photos_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'court-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.photo_path = storage.objects.name
        AND c.moderation_status = 'approved'
    ))
  WITH CHECK (bucket_id = 'court-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.photo_path = storage.objects.name
        AND c.moderation_status = 'approved'
    ));

DROP POLICY IF EXISTS court_photos_delete ON storage.objects;
CREATE POLICY court_photos_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'court-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.photo_path = storage.objects.name
        AND c.moderation_status = 'approved'
    ));
