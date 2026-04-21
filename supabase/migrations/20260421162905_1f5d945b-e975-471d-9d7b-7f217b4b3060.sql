-- Tabela para múltiplas narrações por página (narrador + personagens)
CREATE TABLE public.page_narrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT 'Narração',
  text text,
  voice_id text,
  voice_engine text NOT NULL DEFAULT 'gemini',
  style text,
  narration_speed text,
  audio_url text,
  audio_duration_seconds numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_narrations_page ON public.page_narrations(page_id, position);
CREATE INDEX idx_page_narrations_project ON public.page_narrations(project_id);

ALTER TABLE public.page_narrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own page narrations"
ON public.page_narrations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = page_narrations.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create own page narrations"
ON public.page_narrations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = page_narrations.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update own page narrations"
ON public.page_narrations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = page_narrations.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete own page narrations"
ON public.page_narrations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = page_narrations.project_id AND projects.user_id = auth.uid()
));

CREATE TRIGGER update_page_narrations_updated_at
BEFORE UPDATE ON public.page_narrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();