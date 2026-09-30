-- Campus identity: academic address → code → verified student of that university; school and year.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}');

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN coalesce(cond, false) THEN 'PASS' ELSE 'FAIL' END, label; END $$;
CREATE FUNCTION pg_temp.fails(stmt text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;
CREATE FUNCTION pg_temp.err(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN 'none'; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon, service_role;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''

-- 01 data + address matching
SELECT pg_temp.ok('01a NTUA with its nine schools', (SELECT count(*) FROM public.departments WHERE university_id = 'ntua') = 9);
SELECT pg_temp.ok('01b @ntua.gr and any @<sub>.ntua.gr, nothing else',
  private.university_for_email('el19001@mail.ntua.gr') = 'ntua' AND private.university_for_email(' X@NTUA.GR ') = 'ntua'
  AND private.university_for_email('a@ece.ntua.gr') = 'ntua'
  AND private.university_for_email('a@gmail.com') IS NULL AND private.university_for_email('a@notntua.gr') IS NULL
  AND private.university_for_email('a@ntua.gr.evil.com') IS NULL AND private.university_for_email('ntua.gr') IS NULL);

-- 02 only the Worker (service role) issues codes
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('02a users cannot issue codes', pg_temp.fails(format($$SELECT public.student_code_issue(%L, 'el1@mail.ntua.gr', '123456')$$, :A))
  AND pg_temp.fails(format($$SELECT private.student_code_issue(%L, 'el1@mail.ntua.gr', '123456')$$, :A)));
SELECT pg_temp.ok('02b nor change their own campus fields', pg_temp.fails($$UPDATE public.profiles SET university_id = 'ntua', student_verified_at = now() WHERE id = auth.uid()$$)
  AND pg_temp.fails('SELECT * FROM private.student_codes'));
RESET ROLE; SET ROLE service_role;
SELECT pg_temp.ok('02c non-academic address refused', pg_temp.err(format($$SELECT public.student_code_issue(%L, 'anna@gmail.com', '123456')$$, :A)) = 'not_academic');
SELECT public.student_code_issue(:A, 'El19001@Mail.NTUA.gr', '482913') AS uni \gset
SELECT pg_temp.ok('02d code issued for NTUA', :'uni' = 'ntua');
RESET ROLE;
SELECT pg_temp.ok('02e only hashes are stored', (SELECT code_hash <> '482913' AND email_hash NOT LIKE '%ntua%' FROM private.student_codes WHERE user_id = :A));

-- 03 typing the code
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('03a wrong code counts a try', public.verify_student_code('000000') = 'bad_code');
RESET ROLE;
SELECT pg_temp.ok('03b (attempt stored)', (SELECT attempts FROM private.student_codes WHERE user_id = :A) = 1);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.verify_student_code(' 482913 ') AS res \gset
SELECT pg_temp.ok('03c right code → verified NTUA student', :'res' = 'ok'
  AND (SELECT university_id = 'ntua' AND student_verified_at IS NOT NULL FROM public.profiles WHERE id = auth.uid()));
SELECT pg_temp.ok('03d the code is used up', public.verify_student_code('482913') = 'no_code');
SELECT public.set_student_info('ntua-ece', 3);
SELECT pg_temp.ok('03e school and year', (SELECT department_id = 'ntua-ece' AND study_year = 3 FROM public.profiles WHERE id = auth.uid()));
SELECT pg_temp.ok('03f no school of another university, no year 9',
  pg_temp.fails($$SELECT public.set_student_info('uoa-law', 1)$$) AND pg_temp.fails($$SELECT public.set_student_info('ntua-ece', 9)$$));
RESET ROLE;

-- 04 one address, one account; limits
SET ROLE service_role;
SELECT pg_temp.ok('04a the same address for another account is refused',
  pg_temp.err(format($$SELECT public.student_code_issue(%L, 'el19001@mail.ntua.gr', '111111')$$, :B)) = 'email_taken');
SELECT public.student_code_issue(:B, 'el19002@mail.ntua.gr', '111111');
SELECT public.student_code_issue(:B, 'el19002@mail.ntua.gr', '111112');
SELECT public.student_code_issue(:B, 'el19002@mail.ntua.gr', '111113');
SELECT public.student_code_issue(:B, 'el19002@mail.ntua.gr', '111114');
SELECT public.student_code_issue(:B, 'el19002@mail.ntua.gr', '111115');
SELECT pg_temp.ok('04b the latest code replaces the earlier ones; 5 per hour',
  pg_temp.err(format($$SELECT public.student_code_issue(%L, 'el19002@mail.ntua.gr', '111116')$$, :B)) = 'too_many');
RESET ROLE;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('04c an older code no longer works', public.verify_student_code('111111') = 'bad_code');
SELECT public.verify_student_code('000001'); SELECT public.verify_student_code('000002');
SELECT public.verify_student_code('000003'); SELECT public.verify_student_code('000004');
SELECT pg_temp.ok('04d after 5 wrong tries even the right code is refused', public.verify_student_code('111115') = 'too_many');
SELECT pg_temp.ok('04e unverified: no school', pg_temp.fails($$SELECT public.set_student_info('ntua-ece', 1)$$));
RESET ROLE;
UPDATE private.student_codes SET expires_at = now() - interval '1 minute', attempts = 0 WHERE user_id = :B;
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('04f expired code', public.verify_student_code('111115') = 'expired');
RESET ROLE;

-- 05 visible to others, removable
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('05a others see the school on the profile',
  (SELECT university_id = 'ntua' AND department_id = 'ntua-ece' FROM public.profiles WHERE id = :A)
  AND (SELECT short_el FROM public.departments WHERE id = 'ntua-ece') = 'ΗΜΜΥ');
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.clear_student_identity();
SELECT pg_temp.ok('05b clearing removes it all', (SELECT university_id IS NULL AND department_id IS NULL AND study_year IS NULL FROM public.profiles WHERE id = auth.uid()));
RESET ROLE;
SELECT pg_temp.ok('05c ... the address hash too (it can be used again)', NOT EXISTS (SELECT 1 FROM private.student_emails WHERE user_id = :A));
SET ROLE anon;
SELECT pg_temp.ok('05d anon sees no universities', pg_temp.fails('SELECT * FROM public.universities')
  OR NOT EXISTS (SELECT 1 FROM public.universities));
RESET ROLE;
