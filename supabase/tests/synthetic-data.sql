-- Synthetic test data for the staging project. Safe to run more than once.
-- Two fictional authors with no password (they cannot sign in); emails use the
-- reserved .invalid domain so nothing is ever delivered. Remove everything
-- with supabase/tests/synthetic-data-cleanup.sql.

INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '5e5e0000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'autor-a@synthetic.invalid', now(), '{"provider":"email","providers":["email"],"synthetic":true}', '{"name":"Autor Sintético A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '5e5e0000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'autor-b@synthetic.invalid', now(), '{"provider":"email","providers":["email"],"synthetic":true}', '{"name":"Autor Sintético B"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- GoTrue cannot read NULL token columns; raw-inserted users need empty strings.
UPDATE auth.users
SET confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
WHERE email LIKE '%@synthetic.invalid';

INSERT INTO public.projects (id, user_id, name, book_title, book_type, total_pages, processing_status)
VALUES
  ('5e5e0000-0000-4000-8000-0000000001a1', '5e5e0000-0000-4000-8000-00000000000a', 'Livro Sintético A', 'A Ilha das Vozes', 'general', 3, 'completed'),
  ('5e5e0000-0000-4000-8000-0000000001b1', '5e5e0000-0000-4000-8000-00000000000b', 'Livro Sintético B', 'O Mapa Tátil', 'general', 2, 'completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pages (id, project_id, page_number, audiobook_text, audiobook_status, audiodesc_text, audiodesc_status)
VALUES
  ('5e5e0000-0000-4000-8000-0000000002a1', '5e5e0000-0000-4000-8000-0000000001a1', 1, 'Era uma vez uma ilha onde cada pedra contava uma história.', 'pending', 'Ilustração de uma ilha verde cercada por mar calmo.', 'pending'),
  ('5e5e0000-0000-4000-8000-0000000002a2', '5e5e0000-0000-4000-8000-0000000001a1', 2, 'A menina Lia escutava as pedras ao amanhecer.', 'pending', 'Menina sentada na areia com a mão sobre uma pedra.', 'pending'),
  ('5e5e0000-0000-4000-8000-0000000002a3', '5e5e0000-0000-4000-8000-0000000001a1', 3, 'Naquela manhã, uma pedra ficou em silêncio.', 'pending', NULL, 'pending'),
  ('5e5e0000-0000-4000-8000-0000000002b1', '5e5e0000-0000-4000-8000-0000000001b1', 1, 'O mapa tinha relevos que os dedos podiam ler.', 'pending', 'Mapa em alto-relevo com montanhas e rios.', 'pending'),
  ('5e5e0000-0000-4000-8000-0000000002b2', '5e5e0000-0000-4000-8000-0000000001b1', 2, 'Cada rio levava a uma cidade diferente.', 'pending', NULL, 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.chapters (id, project_id, title, start_page, end_page, "order")
VALUES
  ('5e5e0000-0000-4000-8000-0000000003a1', '5e5e0000-0000-4000-8000-0000000001a1', 'Capítulo 1: A ilha', 1, 2, 0),
  ('5e5e0000-0000-4000-8000-0000000003a2', '5e5e0000-0000-4000-8000-0000000001a1', 'Capítulo 2: O silêncio', 3, 3, 1),
  ('5e5e0000-0000-4000-8000-0000000003b1', '5e5e0000-0000-4000-8000-0000000001b1', 'Capítulo único', 1, 2, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.page_narrations (id, page_id, project_id, position, label, text, voice_engine)
VALUES
  ('5e5e0000-0000-4000-8000-0000000004a1', '5e5e0000-0000-4000-8000-0000000002a2', '5e5e0000-0000-4000-8000-0000000001a1', 0, 'Narrador', 'A menina Lia escutava as pedras ao amanhecer.', 'gemini'),
  ('5e5e0000-0000-4000-8000-0000000004a2', '5e5e0000-0000-4000-8000-0000000002a2', '5e5e0000-0000-4000-8000-0000000001a1', 1, 'Lia', 'Vocês estão me ouvindo?', 'gemini')
ON CONFLICT (id) DO NOTHING;
