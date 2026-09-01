
-- Storage policies for page-images bucket
CREATE POLICY "Authenticated users can upload page images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'page-images');

CREATE POLICY "Authenticated users can update page images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'page-images');

CREATE POLICY "Anyone can read page images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'page-images');

-- Storage policies for page-thumbnails bucket
CREATE POLICY "Authenticated users can upload page thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'page-thumbnails');

CREATE POLICY "Authenticated users can update page thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'page-thumbnails');

CREATE POLICY "Anyone can read page thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'page-thumbnails');

-- Storage policies for audiobook-audios bucket
CREATE POLICY "Authenticated users can upload audiobook audios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audiobook-audios');

CREATE POLICY "Authenticated users can update audiobook audios"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audiobook-audios');

CREATE POLICY "Authenticated users can read audiobook audios"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audiobook-audios');

-- Storage policies for audiodesc-audios bucket
CREATE POLICY "Authenticated users can upload audiodesc audios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audiodesc-audios');

CREATE POLICY "Authenticated users can update audiodesc audios"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audiodesc-audios');

CREATE POLICY "Authenticated users can read audiodesc audios"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audiodesc-audios');

-- Storage policies for videobook-final bucket
CREATE POLICY "Authenticated users can upload videobook final"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videobook-final');

CREATE POLICY "Authenticated users can read videobook final"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videobook-final');

-- Storage policies for pdfs bucket (upload)
CREATE POLICY "Authenticated users can upload pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Authenticated users can read own pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pdfs');

-- Reset the project so it can be reprocessed
-- Project-specific recovery updates belong in an audited data migration,
-- not in the reusable schema history.
