-- Courses (catalog) and course files (notes / past papers): who sees, who uploads, reports, the sweeper.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x', '{"full_name":"Eve"}'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@x', '{"full_name":"Fay"}');

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
\set E '''00000000-0000-0000-0000-00000000000e'''
\set F '''00000000-0000-0000-0000-00000000000f'''

-- A, B, D: ΕΜΠ students; C: ΕΚΠΑ student; E: unverified; F: admin (not a student)
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() WHERE id IN (:A, :B, :D);
UPDATE public.profiles SET university_id = 'uoa', department_id = 'uoa-law', student_verified_at = now() WHERE id = :C;
INSERT INTO private.admins (user_id) VALUES (:F);

SELECT pg_temp.ok('c1 catalog imported: ΕΜΠ, ΕΚΠΑ, the other Attica universities + ΑΠΘ + Πάτρα + Κρήτη + Πολυτεχνείο Κρήτης + Ιωάννινα + ΔΠΘ + ΠΔΜ + ΔΙΠΑΕ + Θεσσαλίας + ΕΛΜΕΠΑ, every kind',
  (SELECT count(*) FROM public.courses) > 27000
  AND (SELECT count(DISTINCT university_id) FROM public.courses) = 20
  AND (SELECT count(DISTINCT kind) FROM public.courses) = 3
  AND NOT EXISTS (SELECT 1 FROM public.courses c JOIN public.departments d ON d.id = c.department_id
                  WHERE d.university_id <> c.university_id));

-- the course everyone uses below: the first ΗΜΜΥ course
CREATE TEMP TABLE t AS SELECT id FROM public.courses WHERE department_id = 'ntua-ece' ORDER BY semester, position LIMIT 1;
GRANT SELECT ON t TO authenticated;
\set K '(SELECT id FROM t)'

SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('c2 a student sees only their university''s courses',
  EXISTS (SELECT 1 FROM public.courses WHERE department_id = 'ntua-ece')
  AND NOT EXISTS (SELECT 1 FROM public.courses WHERE university_id <> 'ntua'));
RESET ROLE;
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('c3 unverified: no courses', NOT EXISTS (SELECT 1 FROM public.courses));
RESET ROLE;

-- A uploads a PDF to their own folder, then adds it to the course
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('course-files', '00000000-0000-0000-0000-00000000000a/n1.pdf', '{"size": 12345, "mimetype": "application/pdf"}'),
  ('course-files', '00000000-0000-0000-0000-00000000000b/b1.pdf', '{"size": 10, "mimetype": "application/pdf"}'),
  ('course-files', '00000000-0000-0000-0000-00000000000c/c1.pdf', '{"size": 10, "mimetype": "application/pdf"}');
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('c4 add: someone else''s file / bad kind / empty title refused',
  pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'notes', 'x', '00000000-0000-0000-0000-00000000000b/b1.pdf')) = 'file_missing'
  AND pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'video', 'x', '00000000-0000-0000-0000-00000000000a/n1.pdf')) = 'bad_kind'
  AND pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'notes', '  ', '00000000-0000-0000-0000-00000000000a/n1.pdf')) = 'empty_post'
  AND pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'notes', 'x', '00000000-0000-0000-0000-00000000000a/none.pdf')) = 'file_missing');
-- (an action and its check are separate statements: a statement's subqueries don't see what it changed)
SELECT pg_temp.ok('c5 add own file: ok',
  pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'exams', 'Θέματα Φεβρουαρίου 2025', '00000000-0000-0000-0000-00000000000a/n1.pdf')) = 'none');
SELECT pg_temp.ok('c5b size and type from the stored object, counter up',
  (SELECT size_bytes = 12345 AND mime = 'application/pdf' FROM public.course_files)
  AND (SELECT files_count FROM public.courses WHERE id = :K) = 1);
SELECT pg_temp.ok('c6 the same file twice: refused',
  pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'notes', 'y', '00000000-0000-0000-0000-00000000000a/n1.pdf')) = 'file_missing');
RESET ROLE;

SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('c7 another university: can''t see the file (row or object), can''t add to the course',
  NOT EXISTS (SELECT 1 FROM public.course_files)
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000a/n1.pdf')
  AND pg_temp.err(format('SELECT public.add_course_file(%L, %L, %L, %L)', :K, 'notes', 'x', '00000000-0000-0000-0000-00000000000c/c1.pdf')) = 'not_found');
RESET ROLE;

SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('c8 a classmate sees the row and may read the object',
  EXISTS (SELECT 1 FROM public.course_files)
  AND EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000a/n1.pdf'));
SELECT pg_temp.ok('c9 no client writes; others can''t delete it',
  pg_temp.err($$UPDATE public.course_files SET title = 'x'$$) = 'none' AND (SELECT title FROM public.course_files) <> 'x'
  AND pg_temp.err(format('SELECT public.delete_course_file(%L)', (SELECT id FROM public.course_files))) = 'not_found');
RESET ROLE;

-- a block hides it both ways
INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (:A, :D);
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('c10 blocked: the file is not shown', NOT EXISTS (SELECT 1 FROM public.course_files));
RESET ROLE;
DELETE FROM public.blocks;

-- reports: B, D and C? (C can't see it) → only ΕΜΠ students report; 3 reporters hide it
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-000000000010', 'gus@x', '{"full_name":"Gus"}');
UPDATE public.profiles SET university_id = 'ntua', student_verified_at = now() WHERE id = '00000000-0000-0000-0000-000000000010';
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('c11 can''t report a file you can''t see',
  pg_temp.err(format('SELECT public.report_content(%L, %L, %L)', 'course_file', (SELECT id FROM public.course_files), 'spam')) <> 'none');
RESET ROLE;
SELECT pg_temp.as_user(:B); SET ROLE authenticated; SELECT public.report_content('course_file', (SELECT id FROM public.course_files), 'copyright'); RESET ROLE;
SELECT pg_temp.as_user(:D); SET ROLE authenticated; SELECT public.report_content('course_file', (SELECT id FROM public.course_files), 'spam'); RESET ROLE;
SELECT pg_temp.ok('c12 two reports: still shown; admin notified', NOT (SELECT hidden FROM public.course_files)
  AND EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :F AND kind = 'report'));
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000010'); SET ROLE authenticated;
SELECT public.report_content('course_file', (SELECT id FROM public.course_files), 'spam');
RESET ROLE;
SELECT pg_temp.ok('c13 three reporters: hidden, counter down',
  (SELECT hidden FROM public.course_files) AND (SELECT files_count FROM public.courses WHERE id = :K) = 0);
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('c14 hidden: classmates no longer see it', NOT EXISTS (SELECT 1 FROM public.course_files)
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'course-files' AND name LIKE '00000000-0000-0000-0000-00000000000a/%'));
RESET ROLE;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('c15 the uploader still sees their hidden file', EXISTS (SELECT 1 FROM public.course_files WHERE hidden));
RESET ROLE;

-- a campus moderator (D) sees it in the queue and dismisses → shown again
INSERT INTO private.campus_moderators (user_id, university_id) VALUES (:D, 'ntua');
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('c16 moderator: the queue shows the file with its course',
  (SELECT count(*) FROM public.admin_reports(true) WHERE kind = 'course_file' AND file_exists AND file_hidden
     AND file_title = 'Θέματα Φεβρουαρίου 2025' AND course_name IS NOT NULL) = 3
  AND public.admin_open_reports() = 3
  AND EXISTS (SELECT 1 FROM public.course_files));
SELECT pg_temp.ok('c17 moderator dismisses: all 3 closed, shown again',
  public.admin_resolve_report((SELECT id FROM public.admin_reports(true) LIMIT 1), 'dismiss') = 3);
RESET ROLE;
SELECT pg_temp.ok('c17b dismissed file visible again', NOT (SELECT hidden FROM public.course_files)
  AND (SELECT files_count FROM public.courses WHERE id = :K) = 1);

-- a new report, the admin deletes the file → the sweeper lists the stored object
SELECT pg_temp.as_user(:B); SET ROLE authenticated; SELECT public.report_content('course_file', (SELECT id FROM public.course_files), 'other'); RESET ROLE;
SELECT pg_temp.as_user(:F); SET ROLE authenticated;
SELECT pg_temp.ok('c18 bad action for a file refused',
  pg_temp.err(format('SELECT public.admin_resolve_report(%L, %L)', (SELECT id FROM public.admin_reports(true) LIMIT 1), 'delete_group')) = 'bad_action');
SELECT pg_temp.ok('c19 admin deletes the file',
  public.admin_resolve_report((SELECT id FROM public.admin_reports(true) LIMIT 1), 'delete_file') = 1);
SELECT pg_temp.ok('c19b the file row is gone', NOT EXISTS (SELECT 1 FROM public.course_files));
RESET ROLE;
UPDATE storage.objects SET created_at = now() - interval '2 hours';
SET ROLE service_role;
SELECT pg_temp.ok('c20 sweeper: unused course files (service role only)',
  (SELECT count(*) FROM public.orphan_course_files()) = 3);
RESET ROLE;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('c21 sweeper refused to users', pg_temp.err('SELECT * FROM public.orphan_course_files()') = 'not_allowed');

-- delete your own
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('course-files', '00000000-0000-0000-0000-00000000000a/n2.jpg', '{"size": 5}');
SELECT public.add_course_file((SELECT id FROM t), 'notes', 'Σημειώσεις κεφ. 1', '00000000-0000-0000-0000-00000000000a/n2.jpg');
SELECT pg_temp.ok('c22 image without mimetype metadata: jpeg', (SELECT mime FROM public.course_files) = 'image/jpeg');
SELECT pg_temp.ok('c23 delete own file', pg_temp.err(format('SELECT public.delete_course_file(%L)', (SELECT id FROM public.course_files))) = 'none');
SELECT pg_temp.ok('c23b gone', NOT EXISTS (SELECT 1 FROM public.course_files));
RESET ROLE;
SELECT pg_temp.ok('c24 counter back to 0', (SELECT files_count FROM public.courses WHERE id = :K) = 0);
