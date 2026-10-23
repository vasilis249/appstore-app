-- Course Q&A (questions tied to a course, notices to takers, helpful answers) and push settings per category.
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

-- A, B, D: ΕΜΠ ΗΜΜΥ; C: ΕΚΠΑ. B and D take the course; D has blocked A.
UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', student_verified_at = now() WHERE id IN (:A, :B, :D);
UPDATE public.profiles SET university_id = 'uoa', department_id = 'uoa-law', student_verified_at = now() WHERE id = :C;
CREATE TEMP TABLE t AS SELECT id FROM public.courses WHERE department_id = 'ntua-ece' ORDER BY semester, position LIMIT 2;
GRANT SELECT ON t TO authenticated, service_role;
\set K '(SELECT id FROM t ORDER BY id LIMIT 1)'
\set K2 '(SELECT id FROM t ORDER BY id DESC LIMIT 1)'
INSERT INTO public.course_takers (user_id, course_id) SELECT u, (SELECT id FROM t ORDER BY id LIMIT 1) FROM unnest(ARRAY[:B, :D]::uuid[]) u;
INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (:D, :A);

-- asking
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
CREATE TEMP TABLE q AS SELECT public.ask_course_question(:K, 'Πώς λύνεται η άσκηση 3;') AS id;
SELECT pg_temp.ok('q1 a question is a campus post in «Ερωτήσεις» tied to the course',
  (SELECT course_id = :K AND university_id = 'ntua' AND section_id = 'questions' AND reply_to IS NULL
   FROM public.posts WHERE id = (SELECT id FROM q)));
SELECT pg_temp.ok('q2 the course scope lists it, with the course name',
  (SELECT count(*) FROM public.feed_posts('course', p_course := :K) f WHERE f.post_id = (SELECT id FROM q) AND f.course_name IS NOT NULL) = 1
  AND (SELECT count(*) FROM public.feed_posts('course', p_course := :K2)) = 0);
SELECT pg_temp.ok('q3 it shows on the campus feed too (discovery)',
  EXISTS (SELECT 1 FROM public.feed_posts('campus') f WHERE f.post_id = (SELECT id FROM q) AND f.course_id = :K));
SELECT pg_temp.ok('q4 empty question refused like any post', pg_temp.err(format('SELECT public.ask_course_question(%L)', :K)) = 'empty_post');
RESET ROLE;
SELECT pg_temp.ok('q5 takers told (not the asker, not who blocked them), one notice per course',
  (SELECT count(*) FROM public.notifications WHERE kind = 'course_question' AND user_id = :B AND course_id = :K AND count = 1) = 1
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'course_question' AND user_id IN (:A, :D)));
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.ask_course_question(:K, 'Και η 4;');
RESET ROLE;
SELECT pg_temp.ok('q6 a second question folds into the unread notice (count 2)',
  (SELECT count(*) FROM public.notifications WHERE kind = 'course_question' AND user_id = :B) = 1
  AND (SELECT count FROM public.notifications WHERE kind = 'course_question' AND user_id = :B) = 2);

-- other universities: can't ask, can't see
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('q7 another university: not_found, sees nothing',
  pg_temp.err(format('SELECT public.ask_course_question(%L, %L)', :K, 'x')) = 'not_found'
  AND (SELECT count(*) FROM public.feed_posts('course', p_course := :K)) = 0);
RESET ROLE;
SELECT pg_temp.ok('q8 course_id only on campus top-level posts (constraint)',
  pg_temp.err(format('UPDATE public.posts SET course_id = %L WHERE id = (SELECT id FROM public.posts WHERE university_id IS NOT NULL LIMIT 1) AND false', :K)) = 'none'
  AND pg_temp.err(format('INSERT INTO public.posts (author_id, title, course_id) VALUES (%L, %L, %L)', :B, 'x', :K)) LIKE '%posts_course_question%');

-- answers + helpful
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
CREATE TEMP TABLE r AS SELECT public.create_post(p_reply_to := (SELECT id FROM q), p_title := 'Με αντικατάσταση') AS id;
CREATE TEMP TABLE r2 AS SELECT public.create_post(p_reply_to := (SELECT id FROM q), p_title := 'Ή με παραγοντοποίηση') AS id;
SELECT pg_temp.ok('q9 only the asker marks', pg_temp.err(format('SELECT public.mark_helpful_answer(%L, %L)', (SELECT id FROM q), (SELECT id FROM r))) = 'not_found');
RESET ROLE;
GRANT SELECT ON q, r, r2 TO authenticated;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.mark_helpful_answer((SELECT id FROM q), (SELECT id FROM r));
SELECT pg_temp.ok('q10 helpful answer: set on the question, flagged on the reply',
  (SELECT helpful_reply_id FROM public.posts WHERE id = (SELECT id FROM q)) = (SELECT id FROM r)
  AND (SELECT is_helpful FROM public.feed_posts('replies', p_parent := (SELECT id FROM q)) f WHERE f.post_id = (SELECT id FROM r))
  AND NOT (SELECT is_helpful FROM public.feed_posts('replies', p_parent := (SELECT id FROM q)) f WHERE f.post_id = (SELECT id FROM r2)));
SELECT pg_temp.ok('q11 a reply to another post can''t be marked',
  pg_temp.err(format('SELECT public.mark_helpful_answer(%L, %L)', (SELECT id FROM q), (SELECT id FROM t LIMIT 1))) = 'not_found');
RESET ROLE;
SELECT pg_temp.ok('q12 the answerer is told',
  (SELECT count(*) FROM public.notifications WHERE kind = 'answer_helpful' AND user_id = :B AND post_id = (SELECT id FROM r)) = 1);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.mark_helpful_answer((SELECT id FROM q), (SELECT id FROM r2));
SELECT public.mark_helpful_answer((SELECT id FROM q), NULL);
RESET ROLE;
SELECT pg_temp.ok('q13 changing / taking it back: no helpful left, old notices removed',
  (SELECT helpful_reply_id FROM public.posts WHERE id = (SELECT id FROM q)) IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'answer_helpful'));

-- push settings per category
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('q14 six categories, all on by default',
  (SELECT count(*) FROM public.my_push_settings() WHERE push) = 6);
SELECT public.set_push_setting('reactions', false);
SELECT pg_temp.ok('q15 switching one off', (SELECT push FROM public.my_push_settings() WHERE category = 'reactions') = false
  AND (SELECT count(*) FROM public.my_push_settings() WHERE push) = 5);
SELECT pg_temp.ok('q16 unknown category refused', pg_temp.err('SELECT public.set_push_setting(''spam'', false)') = 'bad_category');
SELECT pg_temp.ok('q17 the mutes table is private', pg_temp.err('SELECT * FROM private.push_mutes') LIKE 'permission denied%');
RESET ROLE;
SELECT pg_temp.ok('q18 kinds map to categories (reports always sent)',
  private.notification_category('like') = 'reactions' AND private.notification_category('course_question') = 'courses'
  AND private.notification_category('dm') = 'messages' AND private.notification_category('group_invite') = 'groups'
  AND private.notification_category('report') IS NULL);

-- dispatch: a muted category sends nothing, others still go (net.http_post stubbed to record calls)
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE public.sent (body jsonb);
CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int) RETURNS bigint
  LANGUAGE sql AS $$ INSERT INTO public.sent VALUES (body); SELECT 1::bigint $$;
INSERT INTO private.push_config (url, secret) VALUES ('https://x', 's');
INSERT INTO private.push_tokens (token, user_id, lang) VALUES (repeat('ab', 32), :B, 'el');
INSERT INTO public.notifications (user_id, actor_id, kind, post_id) VALUES (:B, :A, 'like', (SELECT id FROM r));
SELECT pg_temp.ok('q19 muted category (reactions): no push', NOT EXISTS (SELECT 1 FROM public.sent));
INSERT INTO public.notifications (user_id, actor_id, kind, post_id) VALUES (:B, :A, 'reply', (SELECT id FROM r));
SELECT pg_temp.ok('q20 other categories still pushed', (SELECT count(*) FROM public.sent) = 1);
SELECT pg_temp.ok('q21 push text for a course question',
  (SELECT body FROM private.push_job('n', (SELECT id::text FROM public.notifications WHERE kind = 'course_question' AND user_id = :B)))
    LIKE '2 νέες ερωτήσεις%'
  AND (SELECT route FROM private.push_job('n', (SELECT id::text FROM public.notifications WHERE kind = 'course_question' AND user_id = :B))) LIKE '/p/%');
