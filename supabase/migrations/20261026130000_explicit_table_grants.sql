-- Newer Supabase projects no longer grant SELECT/INSERT/UPDATE/DELETE on new
-- public tables to the API roles by default. Without these grants the app
-- (authenticated) and the Edge Functions (service_role) cannot read or write
-- anything. RLS policies still decide which rows each user reaches.
-- anon gets no table access: every screen with data requires sign-in.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.projects, public.pages, public.chapters, public.page_narrations
  TO authenticated;

-- Profiles are created by the handle_new_user trigger; column-level UPDATE
-- (name and voice preferences) was granted in 20260729180000.
GRANT SELECT ON public.profiles TO authenticated;

-- Roles are assigned only by the backend.
GRANT SELECT ON public.user_roles TO authenticated;

GRANT ALL
  ON public.profiles, public.projects, public.pages, public.chapters,
     public.page_narrations, public.user_roles
  TO service_role;
