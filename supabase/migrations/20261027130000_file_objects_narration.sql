-- Audio generated for an extra narration (narrator or character voice) is
-- tracked per narration, so regenerating one replaces only its own file.
ALTER TABLE public.file_objects
  ADD COLUMN IF NOT EXISTS narration_id uuid REFERENCES public.page_narrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_file_objects_narration ON public.file_objects (narration_id) WHERE narration_id IS NOT NULL;
