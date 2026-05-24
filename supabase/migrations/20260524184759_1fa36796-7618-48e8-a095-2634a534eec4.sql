DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users read own page-images'
  ) THEN
    CREATE POLICY "Users read own page-images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'page-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users read own page-thumbnails'
  ) THEN
    CREATE POLICY "Users read own page-thumbnails"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'page-thumbnails'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;