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

-- 06 campus voices: only students of that university hear them; nowhere else
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}');
\set C '''00000000-0000-0000-0000-00000000000c'''
UPDATE public.profiles SET university_id = 'ntua', student_verified_at = now(), department_id = 'ntua-ece' WHERE id IN (:A, :B);
INSERT INTO private.admins (user_id) VALUES (:A);
INSERT INTO public.follows (follower_id, followee_id) VALUES (:C, :A), (:B, :A);
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('voices', '00000000-0000-0000-0000-00000000000a/c1.m4a'), ('voices', '00000000-0000-0000-0000-00000000000a/c2.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000b/c3.m4a'), ('voices', '00000000-0000-0000-0000-00000000000b/c4.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000c/c5.m4a'), ('voices', '00000000-0000-0000-0000-00000000000c/c6.m4a');
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.create_post(p_section := 'exams', p_title := 'Ανάλυση ΙΙ tips', p_path := '00000000-0000-0000-0000-00000000000a/c1.m4a',
  p_mime := 'audio/mp4', p_duration_ms := 3000, p_campus := true) AS cv \gset
SELECT pg_temp.ok('06a campus voice in a student section',
  (SELECT university_id = 'ntua' AND section_id = 'exams' FROM public.posts WHERE id = :'cv'));
SELECT pg_temp.ok('06b sections must match (no Tech on campus, no Εξεταστική outside)',
  pg_temp.err($$SELECT public.create_post(p_section := 'tech', p_path := '00000000-0000-0000-0000-00000000000a/c2.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000, p_campus := true)$$) = 'bad_section'
  AND pg_temp.err($$SELECT public.create_post(p_section := 'exams', p_path := '00000000-0000-0000-0000-00000000000a/c2.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$) = 'bad_section');
SELECT public.create_post(p_path := '00000000-0000-0000-0000-00000000000a/c2.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000, p_campus := true) AS cv2 \gset
SELECT pg_temp.ok('06c a campus voice without a section is fine', (SELECT university_id = 'ntua' AND section_id IS NULL FROM public.posts WHERE id = :'cv2'));
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('06d not a student: no campus voice', pg_temp.err($$SELECT public.create_post(p_path := '00000000-0000-0000-0000-00000000000c/c5.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000, p_campus := true)$$) = 'not_verified');
SELECT pg_temp.ok('06e outsiders can''t see, open, like, reply or repost it',
  NOT EXISTS (SELECT 1 FROM public.feed_posts('campus')) AND NOT EXISTS (SELECT 1 FROM public.feed_posts('one', p_parent := :'cv'))
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('author', p_author := :A) WHERE post_id = :'cv')
  AND NOT EXISTS (SELECT 1 FROM public.posts WHERE id = :'cv')
  AND pg_temp.fails(format('SELECT public.like_post(%L)', :'cv'))
  AND pg_temp.fails(format($$SELECT public.create_post(p_reply_to := %L, p_path := '00000000-0000-0000-0000-00000000000c/c5.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$, :'cv')));
SELECT pg_temp.ok('06f ... and profile counts skip it', (SELECT posts FROM public.profile_stats(:A)) = 0);
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('06g classmates hear it in Campus (and by section), with the author''s school',
  (SELECT count(*) FROM public.feed_posts('campus')) = 2
  AND (SELECT count(*) FROM public.feed_posts('campus', p_section := 'exams')) = 1
  AND (SELECT author_university_id = 'ntua' AND author_department_id = 'ntua-ece' AND university_id = 'ntua'
       FROM public.feed_posts('campus', p_section := 'exams')));
SELECT pg_temp.ok('06h campus voices stay out of every other feed',
  NOT EXISTS (SELECT 1 FROM public.feed_posts('all', p_limit := 50) WHERE university_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('foryou', p_limit := 50) WHERE university_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('news', p_limit := 50) WHERE university_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('personal', p_limit := 50) WHERE university_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('following', p_limit := 50) WHERE university_id IS NOT NULL));
SELECT public.create_post(p_reply_to := :'cv', p_path := '00000000-0000-0000-0000-00000000000b/c3.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000) AS cr \gset
SELECT pg_temp.ok('06i replies stay on campus; no repost / quote out of it',
  (SELECT university_id = 'ntua' FROM public.posts WHERE id = :'cr')
  AND pg_temp.fails(format('SELECT public.create_post(p_repost_of := %L)', :'cv'))
  AND pg_temp.fails(format($$SELECT public.create_post(p_repost_of := %L, p_path := '00000000-0000-0000-0000-00000000000b/c4.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$, :'cv')));
RESET ROLE;

-- 07 campus topics, topic of the day, university RSS
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.admin_create_topic('courses', 'Ποιο μάθημα σε έκοψε;', p_daily_date := private.current_moment(), p_university := 'ntua') AS ct \gset
SELECT pg_temp.ok('07a admin: a campus topic needs a student section', pg_temp.fails($$SELECT public.admin_create_topic('tech', 'Λάθος ενότητα', p_university := 'ntua')$$)
  AND pg_temp.fails($$SELECT public.admin_create_topic('exams', 'Λάθος ενότητα')$$));
SELECT public.admin_create_topic('tech', 'Γενικό θέμα της ημέρας', p_daily_date := private.current_moment()) AS gt \gset
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('07b the campus has its own topic of the day, first; the global one stays global',
  (SELECT id FROM public.campus_topics(p_limit := 1)) = :'ct' AND (SELECT is_daily FROM public.campus_topics(p_limit := 1))
  AND (SELECT topic_id FROM public.today()) = :'gt'
  AND NOT EXISTS (SELECT 1 FROM public.news_topics(p_limit := 50) WHERE id = :'ct')
  AND NOT EXISTS (SELECT 1 FROM public.trending_topics(p_limit := 50) WHERE id = :'ct'));
SELECT public.create_post(p_topic := :'ct', p_path := '00000000-0000-0000-0000-00000000000b/c4.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000) AS tv \gset
SELECT pg_temp.ok('07c a voice on a campus topic is a campus voice', (SELECT university_id = 'ntua' AND section_id = 'courses' FROM public.posts WHERE id = :'tv'));
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('07d outsiders: no campus topics, can''t speak on them',
  NOT EXISTS (SELECT 1 FROM public.topics WHERE id = :'ct') AND NOT EXISTS (SELECT 1 FROM public.campus_topics())
  AND pg_temp.err(format($$SELECT public.create_post(p_topic := %L, p_path := '00000000-0000-0000-0000-00000000000c/c6.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$, :'ct')) = 'not_found');
RESET ROLE;
SELECT format($x$<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>ΝΕΑ</title>
<item><title>Η Βραδιά του Ερευνητή 2026 στο ΕΜΠ</title><link>https://www.ntua.gr/el/news/item/5617</link><guid>ntua-5617</guid><pubDate>%1$s</pubDate>
  <description><![CDATA[<img src="https://www.ntua.gr/images/x.jpg" /> κείμενο]]></description></item>
</channel></rss>$x$, to_char(now() AT TIME ZONE 'UTC', 'Dy, DD Mon YYYY HH24:MI:SS') || ' +0000') AS ntua_rss \gset
SELECT private.ingest_feed_xml((SELECT id FROM private.news_feeds WHERE university_id = 'ntua' ORDER BY id LIMIT 1), :'ntua_rss', 2);
SELECT pg_temp.ok('07e university RSS → a campus news topic with its photo',
  (SELECT university_id = 'ntua' AND section_id = 'announcements' AND image_url = 'https://www.ntua.gr/images/x.jpg' FROM public.topics WHERE external_id = 'ntua-5617'));
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('07f students see it in campus topics, not in News',
  EXISTS (SELECT 1 FROM public.campus_topics(p_limit := 50) t JOIN public.topics x ON x.id = t.id WHERE x.external_id = 'ntua-5617')
  AND NOT EXISTS (SELECT 1 FROM public.news_topics(p_limit := 50) WHERE title LIKE 'Η Βραδιά%'));
RESET ROLE;

-- 08 school and school-year groups follow the profile
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@x', '{"full_name":"Eli"}');
\set D '''00000000-0000-0000-0000-00000000000d'''
\set E '''00000000-0000-0000-0000-00000000000e'''
UPDATE public.profiles SET university_id = 'ntua', student_verified_at = now() WHERE id IN (:D, :E);
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.set_student_info('ntua-civil', 2);
RESET ROLE;
SELECT pg_temp.ok('08a choosing school + year puts you in "ΕΜΠ · Πολιτικοί" and "ΕΜΠ · Πολιτικοί · 2ο έτος"',
  (SELECT array_agg(g.name ORDER BY g.name) FROM public.group_members m JOIN public.groups g ON g.id = m.group_id WHERE m.user_id = :D AND g.auto)
    = ARRAY['ΕΜΠ · Πολιτικοί', 'ΕΜΠ · Πολιτικοί · 2ο έτος']
  AND NOT EXISTS (SELECT 1 FROM public.group_members m JOIN public.groups g ON g.id = m.group_id WHERE g.auto AND m.role <> 'member'));
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.set_student_info('ntua-civil', 4);
SELECT pg_temp.ok('08b a classmate joins the same school group (made once), their own year group',
  (SELECT count(*) FROM public.groups WHERE auto AND department_id = 'ntua-civil') = 3
  AND (SELECT members_count FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year IS NULL) = 2);
SELECT pg_temp.ok('08c auto groups are private, not in discover, no invites',
  (SELECT privacy FROM public.groups WHERE auto LIMIT 1) = 'private'
  AND NOT EXISTS (SELECT 1 FROM public.discover_groups() WHERE name LIKE 'ΕΜΠ ·%')
  AND pg_temp.fails(format('SELECT public.invite_to_group(%L, %L)', (SELECT id FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year IS NULL), :D)));
SELECT public.leave_group((SELECT id FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year IS NULL));
SELECT pg_temp.ok('08d you can leave and come back (you still fit)',
  public.join_group((SELECT id FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year IS NULL)) = 'joined');
SELECT pg_temp.ok('08e ... but not into a year group that isn''t yours',
  pg_temp.fails(format('SELECT public.join_group(%L)', (SELECT id FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year = 2)))
  AND (SELECT NOT can_join AND auto FROM public.group_detail((SELECT id FROM public.groups WHERE auto AND department_id = 'ntua-civil' AND study_year = 2))));
SELECT public.set_student_info('ntua-arch', 4);
RESET ROLE;
SELECT pg_temp.ok('08f changing school moves you (out of Πολιτικοί, into Αρχιτέκτονες)',
  (SELECT array_agg(g.name ORDER BY g.name) FROM public.group_members m JOIN public.groups g ON g.id = m.group_id WHERE m.user_id = :E AND g.auto)
    = ARRAY['ΕΜΠ · Αρχιτέκτονες', 'ΕΜΠ · Αρχιτέκτονες · 4ο έτος']);
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.clear_student_identity();
RESET ROLE;
SELECT pg_temp.ok('08g removing your student identity takes you out of them all',
  NOT EXISTS (SELECT 1 FROM public.group_members m JOIN public.groups g ON g.id = m.group_id WHERE m.user_id = :E AND g.auto)
  AND EXISTS (SELECT 1 FROM public.groups WHERE auto AND department_id = 'ntua-arch'));

-- 09 classmates first in suggestions
UPDATE public.profiles SET department_id = 'ntua-civil', study_year = 2 WHERE id = :B;
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('09a suggestions: same school + year first (classmate), then same campus',
  (SELECT id FROM public.suggested_people(5) LIMIT 1) = :B
  AND (SELECT reason FROM public.suggested_people(5) LIMIT 1) = 'classmate'
  AND EXISTS (SELECT 1 FROM public.suggested_people(10) WHERE id = :A AND reason = 'campus')
  AND EXISTS (SELECT 1 FROM public.suggested_people(10) WHERE id = :C AND reason IS NULL));
RESET ROLE;
