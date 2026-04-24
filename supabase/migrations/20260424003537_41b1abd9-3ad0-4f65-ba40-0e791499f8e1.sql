-- 1. chapters table
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  title text NOT NULL,
  start_page integer NOT NULL,
  end_page integer NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  interpreter_mode text NOT NULL DEFAULT 'none',
  interpreter_video_url text,
  videobook_url text,
  videobook_status text NOT NULL DEFAULT 'draft',
  videobook_resolution text,
  videobook_layout text DEFAULT 'single',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapters_page_range_chk CHECK (start_page <= end_page),
  CONSTRAINT chapters_interpreter_mode_chk CHECK (interpreter_mode IN ('vlibras','human_video','none')),
  CONSTRAINT chapters_layout_chk CHECK (videobook_layout IN ('single','double'))
);

CREATE INDEX idx_chapters_project_order ON public.chapters(project_id, "order");

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project chapters"
  ON public.chapters FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = chapters.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can create own project chapters"
  ON public.chapters FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = chapters.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can update own project chapters"
  ON public.chapters FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = chapters.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can delete own project chapters"
  ON public.chapters FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = chapters.project_id AND p.user_id = auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- overlap prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_chapter_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.project_id = NEW.project_id
      AND c.id <> NEW.id
      AND NEW.start_page <= c.end_page
      AND NEW.end_page >= c.start_page
  ) THEN
    RAISE EXCEPTION 'Chapter pages overlap with another chapter in the same project';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chapters_overlap
  BEFORE INSERT OR UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_chapter_overlap();

-- 2. pages.image_hd_url
ALTER TABLE public.pages ADD COLUMN image_hd_url text;

-- 3. storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('page-images-hd', 'page-images-hd', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('interpreter-videos', 'interpreter-videos', false)
  ON CONFLICT (id) DO NOTHING;

-- page-images-hd policies (public read; user-scoped write)
CREATE POLICY "page-images-hd public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'page-images-hd');

CREATE POLICY "page-images-hd user write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'page-images-hd' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "page-images-hd user update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'page-images-hd' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "page-images-hd user delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'page-images-hd' AND auth.uid()::text = (storage.foldername(name))[1]);

-- interpreter-videos policies (private, user-scoped)
CREATE POLICY "interpreter-videos user read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'interpreter-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "interpreter-videos user write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'interpreter-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "interpreter-videos user update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'interpreter-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "interpreter-videos user delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'interpreter-videos' AND auth.uid()::text = (storage.foldername(name))[1]);