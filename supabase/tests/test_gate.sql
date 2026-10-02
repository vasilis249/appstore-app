-- Student gate: an unverified account gets nothing but its own rows and the way to verify; students and admins get in.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x', '{"full_name":"Eve"}');

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN coalesce(cond, false) THEN 'PASS' ELSE 'FAIL' END, label; END $$;
CREATE FUNCTION pg_temp.err(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN 'none'; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon, service_role;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set E '''00000000-0000-0000-0000-00000000000e'''

-- B is a verified student with a voice, a group and a follower; E is an admin who never verified.
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() WHERE id = :B;
INSERT INTO private.admins (user_id) VALUES (:E);
INSERT INTO public.posts (author_id, section_id, title, audio_path, mime, duration_ms)
VALUES (:B, 'unis', 'Μετεγγραφές', '00000000-0000-0000-0000-00000000000b/x.m4a', 'audio/mp4', 3000);
INSERT INTO public.topics (section_id, kind, title) VALUES ('unis', 'topic', 'Εστίες');
INSERT INTO public.follows (follower_id, followee_id) VALUES (:E, :B);

SELECT pg_temp.ok('g1 the gate is on', (SELECT enabled FROM private.app_flags WHERE key = 'student_gate'));

SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('g2 unverified: every content RPC says not_student',
  pg_temp.err($$SELECT * FROM public.feed_posts('foryou')$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.news_topics()$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.search_users('bob')$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.my_threads()$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.walkie_list()$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.map_people(500)$$) = 'not_student'
  AND pg_temp.err($$SELECT * FROM public.today()$$) = 'not_student'
  AND pg_temp.err(format('SELECT public.follow_user(%L)', :B)) = 'not_student');
SELECT pg_temp.ok('g3 unverified: no one else''s rows, only its own profile',
  (SELECT count(*) FROM public.profiles) = 1 AND (SELECT id FROM public.profiles) = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.posts) AND NOT EXISTS (SELECT 1 FROM public.topics)
  AND NOT EXISTS (SELECT 1 FROM public.follows) AND NOT EXISTS (SELECT 1 FROM public.groups));
SELECT pg_temp.ok('g4 unverified: may still claim an invite (answer is about the code, not the gate)',
  pg_temp.err($$SELECT public.claim_invite('ZZZZZZZZ')$$) <> 'not_student');
RESET ROLE;

-- A verifies with an academic address → in.
SET ROLE service_role;
SELECT public.student_code_issue(:A, 'el19001@mail.ntua.gr', '482913');
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('g5 verifying works while unverified', public.verify_student_code('482913') = 'ok');
SELECT pg_temp.ok('g6 verified: feeds and people open',
  pg_temp.err($$SELECT * FROM public.feed_posts('foryou')$$) = 'none'
  AND EXISTS (SELECT 1 FROM public.posts WHERE title = 'Μετεγγραφές')
  AND (SELECT count(*) FROM public.profiles) >= 2);
RESET ROLE;

SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('g7 admins are let in without verifying',
  pg_temp.err($$SELECT * FROM public.feed_posts('foryou')$$) = 'none' AND EXISTS (SELECT 1 FROM public.topics));
RESET ROLE;

SELECT pg_temp.ok('g8 walkie / map-talk channels: students only',
  NOT private.is_student(gen_random_uuid()) AND private.is_student(:A) AND private.is_student(:E)
  AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'realtime' AND policyname IN ('walkie_read', 'walkie_write', 'nearby_read', 'nearby_write')
       AND coalesce(qual, with_check) LIKE '%is_student%') = 4);

UPDATE public.profiles SET university_id = NULL, student_verified_at = NULL WHERE id = :A;
UPDATE private.app_flags SET enabled = false WHERE key = 'student_gate';
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('g9 the flag switches the gate off',
  pg_temp.err($$SELECT * FROM public.feed_posts('foryou')$$) = 'none');
RESET ROLE;
UPDATE private.app_flags SET enabled = true WHERE key = 'student_gate';
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('g10 the app asks am_i_student(): unverified no, admin yes', NOT public.am_i_student());
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('g11 ... admin yes', public.am_i_student());
RESET ROLE;
