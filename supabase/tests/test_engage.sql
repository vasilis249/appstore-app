-- Engagement: downloads, thanks, «Το δίνω», new-file notices, weekly helped, points / top helpers / badges, push jobs.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}');

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
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''

-- A, B, D: ΕΜΠ ΗΜΜΥ (A verified first); C: ΕΚΠΑ
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() - interval '3 days' WHERE id = :A;
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() - interval '2 days' WHERE id IN (:B, :D);
UPDATE public.profiles SET university_id = 'uoa', department_id = 'uoa-law', student_verified_at = now() WHERE id = :C;

CREATE TEMP TABLE t AS SELECT id FROM public.courses WHERE department_id = 'ntua-ece' ORDER BY semester, position LIMIT 1;
GRANT SELECT ON t TO authenticated, service_role;
\set K '(SELECT id FROM t)'
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('course-files', '00000000-0000-0000-0000-00000000000a/a1.pdf', '{"size": 100, "mimetype": "application/pdf"}'),
  ('course-files', '00000000-0000-0000-0000-00000000000a/a2.pdf', '{"size": 100, "mimetype": "application/pdf"}'),
  ('course-files', '00000000-0000-0000-0000-00000000000d/d1.pdf', '{"size": 100, "mimetype": "application/pdf"}');

-- «Το δίνω»
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('e1 take a course: counted, readable as mine',
  (SELECT public.set_taking_course(:K, true)) = 1);
SELECT pg_temp.ok('e1b listed in my courses', EXISTS (SELECT 1 FROM public.course_takers WHERE course_id = :K));
RESET ROLE;
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('e2 another university''s course: not_found; others'' rows hidden',
  pg_temp.err(format('SELECT public.set_taking_course(%L, true)', :K)) = 'not_found'
  AND NOT EXISTS (SELECT 1 FROM public.course_takers));
RESET ROLE;

-- A uploads → B (takes the course) is told; a second file folds into the same unread notice
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.add_course_file(:K, 'notes', 'Σημειώσεις 1', '00000000-0000-0000-0000-00000000000a/a1.pdf');
RESET ROLE;
SELECT pg_temp.ok('e3 new file → notice to the taker (not the uploader)',
  (SELECT count(*) FROM public.notifications WHERE kind = 'course_file' AND user_id = :B AND actor_id = :A AND count = 1) = 1
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'course_file' AND user_id = :A));
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.add_course_file(:K, 'exams', 'Θέματα 2025', '00000000-0000-0000-0000-00000000000a/a2.pdf');
RESET ROLE;
SELECT pg_temp.ok('e4 second file: still one notice, count 2',
  (SELECT count(*) FROM public.notifications WHERE kind = 'course_file' AND user_id = :B) = 1
  AND (SELECT count FROM public.notifications WHERE kind = 'course_file' AND user_id = :B) = 2);

CREATE TEMP TABLE f AS SELECT id, title FROM public.course_files;
GRANT SELECT ON f TO authenticated, service_role;
\set F1 '(SELECT id FROM f WHERE title = ''Σημειώσεις 1'')'

-- downloads: once per classmate, never the uploader
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.record_course_download(:F1); SELECT public.record_course_download(:F1);
RESET ROLE;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.record_course_download(:F1);
RESET ROLE;
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.record_course_download(:F1);
RESET ROLE;
SELECT pg_temp.ok('e5 downloads: distinct classmates only (B twice, A own) = 2',
  (SELECT downloads_count FROM public.course_files WHERE id = :F1) = 2);
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('e6 another university can''t download / thank',
  pg_temp.err(format('SELECT public.record_course_download(%L)', :F1)) = 'not_found'
  AND pg_temp.err(format('SELECT public.thank_course_file(%L, true)', :F1)) = 'not_found');
RESET ROLE;

-- thanks
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('e7 thank: count 1, twice still 1', (SELECT public.thank_course_file(:F1, true)) = 1);
SELECT pg_temp.ok('e7b twice', (SELECT public.thank_course_file(:F1, true)) = 1);
SELECT pg_temp.ok('e7c my thanks readable', EXISTS (SELECT 1 FROM public.course_file_thanks WHERE file_id = :F1));
RESET ROLE;
SELECT pg_temp.ok('e8 uploader told once', (SELECT count(*) FROM public.notifications WHERE kind = 'file_thanks' AND user_id = :A AND actor_id = :B) = 1);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('e9 can''t thank your own file', pg_temp.err(format('SELECT public.thank_course_file(%L, true)', :F1)) = 'not_found');
RESET ROLE;
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.thank_course_file(:F1, true);
SELECT pg_temp.ok('e10 un-thank: count back', (SELECT public.thank_course_file(:F1, false)) = 1);
RESET ROLE;
SELECT pg_temp.ok('e10b un-thank removes the notice',
  NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'file_thanks' AND actor_id = :D));

-- weekly helped
SELECT pg_temp.ok('e11 weekly: one notice for A with 2 classmates', (SELECT private.weekly_helped()) = 1);
SELECT pg_temp.ok('e11b count and actor',
  (SELECT count = 2 AND actor_id IN (:B, :D) FROM public.notifications WHERE kind = 'files_helped' AND user_id = :A));
SELECT private.weekly_helped();
SELECT pg_temp.ok('e11c run again: replaced, not doubled', (SELECT count(*) FROM public.notifications WHERE kind = 'files_helped') = 1);

-- points: A = 2 files ×10 + 2 downloads + 1 thanks ×3 = 25; D uploads one file = 10
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.add_course_file(:K, 'notes', 'Ντόρα', '00000000-0000-0000-0000-00000000000d/d1.pdf');
RESET ROLE;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('e12 top helpers of my department, ranked',
  (SELECT array_agg(points ORDER BY rank) FROM public.top_helpers()) = '{25,10}'
  AND (SELECT full_name FROM public.top_helpers() WHERE rank = 1) = 'Anna');
SELECT pg_temp.ok('e13 stats: A points 25, rank 1, top, founding',
  (SELECT points = 25 AND files = 2 AND downloads = 2 AND thanks = 1 AND rank = 1 AND top AND founding FROM public.helper_stats(:A)));
SELECT pg_temp.ok('e14 stats: B no files → 0, no rank, not top',
  (SELECT points = 0 AND rank IS NULL AND NOT top FROM public.helper_stats(:B)));
SELECT pg_temp.ok('e15 another university''s department / student: nothing',
  NOT EXISTS (SELECT 1 FROM public.top_helpers('uoa-law')) AND NOT EXISTS (SELECT 1 FROM public.helper_stats(:C)));
RESET ROLE;
UPDATE public.course_files SET hidden = true WHERE id = :F1;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('e16 hidden files don''t count', (SELECT points FROM public.helper_stats(:A)) = 10);
RESET ROLE;
UPDATE public.course_files SET hidden = false WHERE id = :F1;

-- untake: the course notice goes
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('e17 untake: count 0', (SELECT public.set_taking_course(:K, false)) = 0);
RESET ROLE;
SELECT pg_temp.ok('e17b untake removes the course notice', NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'course_file' AND user_id = :B));

-- push tokens + jobs
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('e18 bad token refused', pg_temp.err('SELECT public.register_push_token(''nope'')') = 'bad_token');
SELECT public.register_push_token(repeat('ab', 32), 'el');
SELECT pg_temp.ok('e19 push_job not callable by users', pg_temp.err('SELECT * FROM public.push_job(''n'', ''1'')') <> 'none');
RESET ROLE;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.register_push_token(repeat('cd', 32), 'en');
SELECT public.register_push_token(repeat('ab', 32), 'el'); -- same phone, now B
RESET ROLE;
SELECT pg_temp.ok('e20 a token moves to whoever signs in on that phone',
  (SELECT user_id FROM private.push_tokens WHERE token = repeat('ab', 32)) = :B::uuid
  AND (SELECT count(*) FROM private.push_tokens WHERE user_id = :B) = 2);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.register_push_token(repeat('ef', 32), 'el');
RESET ROLE;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.thank_course_file((SELECT id FROM f WHERE title = 'Θέματα 2025'), true);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.ok('e21 push job for a thanks: A''s device, Greek text, course route',
  (SELECT count(*) = 1 AND bool_and(title = 'Bob' AND body = 'σε ευχαρίστησε για «Θέματα 2025» 🙏' AND route = '/c/' || :K)
   FROM public.push_job('n', (SELECT id::text FROM public.notifications WHERE kind = 'file_thanks' AND user_id = :A AND file_id = (SELECT id FROM f WHERE title = 'Θέματα 2025')))));
RESET ROLE;
INSERT INTO public.follows (follower_id, followee_id) VALUES (:A, :B), (:B, :A);
INSERT INTO public.voice_messages (sender_id, recipient_id, body) VALUES (:A, :B, 'Γεια!');
SET ROLE service_role;
SELECT pg_temp.ok('e22 push job for a DM: both of B''s devices, each in its language',
  (SELECT count(*) = 2 AND bool_and(title = 'Anna' AND body = 'Γεια!' AND route = '/messages/' || :A)
   FROM public.push_job('dm', (SELECT id::text FROM public.voice_messages LIMIT 1))));
SELECT public.drop_push_token(repeat('cd', 32));
RESET ROLE;
SELECT pg_temp.ok('e23 dropped token gone; dispatch without config sends nothing (no error)',
  NOT EXISTS (SELECT 1 FROM private.push_tokens WHERE token = repeat('cd', 32)));
