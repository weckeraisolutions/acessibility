-- Phase 1 (exit from Lovable): integrity and privilege fixes found in the
-- migration review of 2026-10-26. Safe to run more than once.

-- 1. chapters.project_id had no foreign key: deleting a project left
--    orphan chapters behind.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chapters_project_id_fkey'
      AND conrelid = 'public.chapters'::regclass
  ) THEN
    ALTER TABLE public.chapters
      ADD CONSTRAINT chapters_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. page_narrations RLS only checks project_id, so a narration could point
--    to a page from another user's project. A composite foreign key forces
--    page_id and project_id to belong to the same page.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pages_id_project_id_key'
      AND conrelid = 'public.pages'::regclass
  ) THEN
    ALTER TABLE public.pages
      ADD CONSTRAINT pages_id_project_id_key UNIQUE (id, project_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'page_narrations_page_project_fkey'
      AND conrelid = 'public.page_narrations'::regclass
  ) THEN
    ALTER TABLE public.page_narrations
      ADD CONSTRAINT page_narrations_page_project_fkey
      FOREIGN KEY (page_id, project_id) REFERENCES public.pages(id, project_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Profiles are created only by the handle_new_user trigger. A client-side
--    INSERT could set plan and pages_used_month, which drive usage limits.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
REVOKE INSERT ON public.profiles FROM anon, authenticated;
