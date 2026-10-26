-- RLS isolation test with synthetic users. Always ends with RAISE EXCEPTION,
-- so every change is rolled back and nothing persists.
DO $$
DECLARE
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  pa uuid; pb uuid; pga uuid;
  n int;
  r text := '';
  ok boolean;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', ua, 'authenticated', 'authenticated', 'rls-a@test.invalid', '{"name":"A"}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', ub, 'authenticated', 'authenticated', 'rls-b@test.invalid', '{"name":"B"}', now(), now());
  SELECT count(*) INTO n FROM public.profiles WHERE id IN (ua, ub);
  r := r || 'T01 trigger cria perfis=' || (n = 2) || '; ';

  -- user B creates a project
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  INSERT INTO public.projects (user_id, name) VALUES (ub, 'B project') RETURNING id INTO pb;

  -- user A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  INSERT INTO public.projects (user_id, name) VALUES (ua, 'A project') RETURNING id INTO pa;
  INSERT INTO public.pages (project_id, page_number) VALUES (pa, 1) RETURNING id INTO pga;
  INSERT INTO public.chapters (project_id, title, start_page, end_page) VALUES (pa, 'Cap 1', 1, 1);

  SELECT count(*) INTO n FROM public.projects;
  r := r || 'T02 A ve so o proprio projeto=' || (n = 1) || '; ';
  SELECT count(*) INTO n FROM public.projects WHERE id = pb;
  r := r || 'T03 A nao le projeto de B=' || (n = 0) || '; ';
  UPDATE public.projects SET name = 'hack' WHERE id = pb;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || 'T04 A nao altera projeto de B=' || (n = 0) || '; ';

  ok := false;
  BEGIN
    INSERT INTO public.projects (user_id, name) VALUES (ub, 'forjado');
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  r := r || 'T05 A nao cria projeto em nome de B=' || ok || '; ';

  ok := false;
  BEGIN
    INSERT INTO public.pages (project_id, page_number) VALUES (pb, 1);
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  r := r || 'T06 A nao cria pagina no projeto de B=' || ok || '; ';

  ok := false;
  BEGIN
    INSERT INTO public.profiles (id, name, email) VALUES (gen_random_uuid(), 'x', 'x@test.invalid');
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  r := r || 'T07 cliente nao cria perfil=' || ok || '; ';

  ok := false;
  BEGIN
    UPDATE public.profiles SET plan = 'pro' WHERE id = ua;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  r := r || 'T08 cliente nao muda plano=' || ok || '; ';

  UPDATE public.profiles SET name = 'A2' WHERE id = ua;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || 'T09 cliente muda o proprio nome=' || (n = 1) || '; ';

  SELECT count(*) INTO n FROM public.profiles;
  r := r || 'T10 A ve so o proprio perfil=' || (n = 1) || '; ';

  -- B tries to attach a narration of B's project to A's page
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  ok := false;
  BEGIN
    INSERT INTO public.page_narrations (page_id, project_id) VALUES (pga, pb);
  EXCEPTION WHEN foreign_key_violation THEN ok := true;
  END;
  r := r || 'T11 narracao nao liga pagina de outro projeto=' || ok || '; ';

  SELECT count(*) INTO n FROM public.chapters;
  r := r || 'T12 B nao ve capitulos de A=' || (n = 0) || '; ';
  SELECT count(*) INTO n FROM public.user_roles WHERE user_id = ua;
  r := r || 'T13 B nao ve papeis de A=' || (n = 0) || '; ';

  -- anonymous visitor
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  ok := false;
  BEGIN
    SELECT count(*) INTO n FROM public.projects;
    ok := (n = 0);
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  r := r || 'T14 anonimo nao ve projetos=' || ok || '; ';

  -- A deletes the project: chapters must cascade
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  DELETE FROM public.projects WHERE id = pa;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.chapters WHERE project_id = pa;
  r := r || 'T15 capitulos apagados com o projeto=' || (n = 0);

  RAISE EXCEPTION 'RESULTADO: %', r;
END $$;
