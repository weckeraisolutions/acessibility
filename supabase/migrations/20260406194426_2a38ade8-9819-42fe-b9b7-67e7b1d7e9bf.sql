
-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  pages_used_month integer NOT NULL DEFAULT 0,
  month_reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  book_title text,
  book_type text NOT NULL DEFAULT 'general',
  pdf_url text,
  total_pages integer NOT NULL DEFAULT 0,
  processing_status text NOT NULL DEFAULT 'pending',
  audiobook_global_style text,
  audiobook_global_voice text DEFAULT 'Zephyr',
  audiodesc_global_style text,
  audiodesc_global_voice text DEFAULT 'Kore',
  videobook_global_transition text DEFAULT 'fade',
  videobook_global_visual_style text,
  videobook_output_format text DEFAULT '16:9',
  videobook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Create pages table
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  image_url text,
  thumbnail_url text,
  audiobook_text text,
  audiobook_audio_url text,
  audiobook_audio_duration_seconds numeric,
  audiobook_status text NOT NULL DEFAULT 'pending',
  audiobook_voice text,
  audiobook_style text,
  audiodesc_text text,
  audiodesc_audio_url text,
  audiodesc_audio_duration_seconds numeric,
  audiodesc_status text NOT NULL DEFAULT 'pending',
  audiodesc_voice text,
  audiodesc_style text,
  video_status text NOT NULL DEFAULT 'pending',
  video_regions jsonb,
  video_animations jsonb,
  video_timestamps jsonb,
  video_transition text,
  video_clip_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, page_number)
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project pages" ON public.pages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = pages.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can create own project pages" ON public.pages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = pages.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update own project pages" ON public.pages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = pages.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can delete own project pages" ON public.pages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = pages.project_id AND projects.user_id = auth.uid())
);

-- Update timestamp function and triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('page-images', 'page-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('page-thumbnails', 'page-thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('audiobook-audios', 'audiobook-audios', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('audiodesc-audios', 'audiodesc-audios', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('videobook-final', 'videobook-final', false);

-- Public bucket policies
CREATE POLICY "Public read page-images" ON storage.objects FOR SELECT USING (bucket_id = 'page-images');
CREATE POLICY "Public read page-thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'page-thumbnails');

-- Private bucket policies (user can only access their own folder)
CREATE POLICY "Users upload own pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own pdfs" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own page-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'page-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own page-thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'page-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own audiobook-audios" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audiobook-audios' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own audiobook-audios" ON storage.objects FOR SELECT USING (bucket_id = 'audiobook-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own audiodesc-audios" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audiodesc-audios' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own audiodesc-audios" ON storage.objects FOR SELECT USING (bucket_id = 'audiodesc-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own videobook-final" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videobook-final' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own videobook-final" ON storage.objects FOR SELECT USING (bucket_id = 'videobook-final' AND auth.uid()::text = (storage.foldername(name))[1]);
