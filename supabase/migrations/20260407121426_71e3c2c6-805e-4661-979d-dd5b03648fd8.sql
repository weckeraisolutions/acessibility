ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_elevenlabs boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS elevenlabs_default_voice_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS elevenlabs_default_model text DEFAULT 'eleven_multilingual_v2';