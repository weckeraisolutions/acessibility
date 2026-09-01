-- Client ebook assets are private and can only be read from the owner's folder.
UPDATE storage.buckets
SET public = false
WHERE id IN ('page-images', 'page-thumbnails', 'page-images-hd');

DROP POLICY IF EXISTS "Users read own page-images" ON storage.objects;
DROP POLICY IF EXISTS "Users read own page-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users read own page-images-hd" ON storage.objects;

CREATE POLICY "Users read own page-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'page-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own page-thumbnails"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'page-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own page-images-hd"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'page-images-hd' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can change presentation preferences, but never billing or usage limits.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, use_elevenlabs, elevenlabs_default_voice_id, elevenlabs_default_model)
  ON public.profiles TO authenticated;
