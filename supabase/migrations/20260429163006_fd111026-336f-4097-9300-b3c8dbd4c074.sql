ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS enable_dual_validation boolean NOT NULL DEFAULT false;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS audiodesc_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audiodesc_validation_score integer,
  ADD COLUMN IF NOT EXISTS audiodesc_validation_violations jsonb,
  ADD COLUMN IF NOT EXISTS audiodesc_text_original text;