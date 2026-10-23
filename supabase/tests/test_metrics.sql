-- Admin metrics: admins only, aggregates (no person in the output), activation / week-1 / Q&A / readiness numbers.
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

-- A: admin. B: ΕΜΠ ΗΜΜΥ verified 20 days ago, took a course on day 2, posted on day 10 (activated + kept).
-- C: ΕΜΠ ΗΜΜΥ verified 20 days ago, did nothing. D: ΕΚΠΑ, verified today via an invite.
INSERT INTO private.admins (user_id) VALUES (:A);
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() - interval '20 days' WHERE id IN (:B, :C);
UPDATE public.profiles SET university_id = 'uoa', department_id = 'uoa-law', student_verified_at = now(), invited_by = :B WHERE id = :D;
INSERT INTO public.course_takers (user_id, course_id, created_at)
  SELECT :B, id, now() - interval '18 days' FROM public.courses WHERE department_id = 'ntua-ece' ORDER BY id LIMIT 1;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
CREATE TEMP TABLE q AS SELECT public.ask_course_question((SELECT id FROM public.courses WHERE department_id = 'ntua-ece' ORDER BY id LIMIT 1), 'Ερώτηση;') AS id;
RESET ROLE;
UPDATE public.posts SET created_at = now() - interval '10 days' WHERE id = (SELECT id FROM q);
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.create_post(p_reply_to := (SELECT id FROM q), p_title := 'Απάντηση');
RESET ROLE;

SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('m1 students can''t read metrics', pg_temp.err('SELECT public.admin_metrics()') = 'not_allowed'
  AND pg_temp.err('SELECT public.admin_metrics(''ntua'')') = 'not_allowed');
SELECT pg_temp.ok('m2 the activity helper is private', pg_temp.err('SELECT * FROM private.student_activity(now())') LIKE 'permission denied%');
RESET ROLE;

SELECT pg_temp.as_user(:A); SET ROLE authenticated;
CREATE TEMP TABLE o AS SELECT public.admin_metrics() AS j;
CREATE TEMP TABLE m AS SELECT public.admin_metrics('ntua') AS j;
RESET ROLE;
SELECT pg_temp.ok('m3 overview: one row per university with students',
  (SELECT jsonb_array_length(j->'universities') FROM o) = 2
  AND (SELECT (r->>'students')::int FROM o, jsonb_array_elements(j->'universities') r WHERE r->>'university_id' = 'ntua') = 2
  AND (SELECT (r->>'new_7d')::int FROM o, jsonb_array_elements(j->'universities') r WHERE r->>'university_id' = 'uoa') = 1);
SELECT pg_temp.ok('m4 campus numbers: students, active, contributors, questions answered',
  (SELECT (j->>'students')::int = 2 AND (j->>'active_7d')::int = 1 AND (j->>'contributors_30d')::int = 2
          AND (j->>'questions_30d')::int = 1 AND (j->>'questions_answered')::int = 1 AND (j->>'questions_helpful')::int = 0 FROM m));
SELECT pg_temp.ok('m5 activation 1 of 2 (took a course in week 1), week-1 kept 1 of 2 (posted on day 10)',
  (SELECT j->'activation' = '{"cohort": 2, "activated": 1}'::jsonb AND j->'week1' = '{"cohort": 2, "kept": 1}'::jsonb FROM m));
SELECT pg_temp.ok('m6 departments with readiness flag (O4 proposal, read-only)',
  (SELECT d->>'department_id' = 'ntua-ece' AND (d->>'students')::int = 2 AND (d->>'resources_30d')::int = 1 AND (d->>'ready')::boolean = false
   FROM m, jsonb_array_elements(j->'departments') d));
SELECT pg_temp.ok('m7 no person in the output (no user ids, names or emails)',
  (SELECT j::text !~ '0000000000[0-9a-d]' AND j::text !~* 'anna|bob|chris|dora' FROM m)
  AND (SELECT j::text !~ '0000000000[0-9a-d]' FROM o));
SELECT pg_temp.ok('m8 calling it twice in one session works (temp tables reused)',
  pg_temp.err('SELECT public.admin_metrics(''uoa'')') = 'none');
