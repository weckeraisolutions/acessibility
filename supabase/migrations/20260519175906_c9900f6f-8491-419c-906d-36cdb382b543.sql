
-- ===== Drop overly broad storage policies =====
DROP POLICY IF EXISTS "Authenticated users can read audiobook audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audiobook audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audiobook audios" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can read audiodesc audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audiodesc audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audiodesc audios" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can read own pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload pdfs" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can read videobook final" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videobook final" ON storage.objects;

-- Page images & thumbnails: drop broad SELECT (listing) and broad INSERT/UPDATE.
-- Public-URL access to objects in public buckets still works without RLS.
DROP POLICY IF EXISTS "Anyone can read page images" ON storage.objects;
DROP POLICY IF EXISTS "Public read page-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update page images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload page images" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can read page thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public read page-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update page thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload page thumbnails" ON storage.objects;

-- ===== Add owner-scoped UPDATE / DELETE where missing =====
-- audiobook-audios
CREATE POLICY "Users update own audiobook-audios"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audiobook-audios' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audiobook-audios' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own audiobook-audios"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audiobook-audios' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- audiodesc-audios
CREATE POLICY "Users update own audiodesc-audios"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audiodesc-audios' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audiodesc-audios' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own audiodesc-audios"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audiodesc-audios' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- videobook-final
CREATE POLICY "Users update own videobook-final"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videobook-final' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'videobook-final' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own videobook-final"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videobook-final' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- page-images (owner-scoped write only; public-URL read works without policy)
CREATE POLICY "Users update own page-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'page-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'page-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own page-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'page-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- page-thumbnails
CREATE POLICY "Users update own page-thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'page-thumbnails' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'page-thumbnails' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own page-thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'page-thumbnails' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- page-images-hd: drop broad public read (listing). Public-URL read still works.
DROP POLICY IF EXISTS "page-images-hd public read" ON storage.objects;

-- ===== Revoke EXECUTE on SECURITY DEFINER helpers =====
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_chapter_overlap() FROM PUBLIC, anon, authenticated;
