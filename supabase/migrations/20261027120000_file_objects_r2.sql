-- Metadata for files stored in the private Cloudflare R2 bucket.
-- Rows are written only by the r2-files Edge Function (service_role); users
-- can read their own rows. Object keys follow:
--   users/{user_id}/projects/{project_id}/{kind}/{file_id}-{safe_name}

CREATE TABLE IF NOT EXISTS public.file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'pdf', 'page-image', 'page-thumbnail', 'page-image-hd',
    'audiobook-audio', 'audiodesc-audio', 'interpreter-video', 'videobook'
  )),
  object_key text NOT NULL UNIQUE,
  original_name text,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded')),
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_objects_project_kind ON public.file_objects (project_id, kind);
CREATE INDEX IF NOT EXISTS idx_file_objects_page ON public.file_objects (page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_objects_pending ON public.file_objects (created_at) WHERE status = 'pending';

ALTER TABLE public.file_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own files" ON public.file_objects;
CREATE POLICY "Users can view own files"
  ON public.file_objects FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_file_objects_updated_at ON public.file_objects;
CREATE TRIGGER update_file_objects_updated_at
  BEFORE UPDATE ON public.file_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.file_objects TO authenticated;
GRANT ALL ON public.file_objects TO service_role;
