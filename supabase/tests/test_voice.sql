-- Profiles, listen-once voice DMs (mutual follows only), blocks, reports, anon/disabled, rate limits, deletion.
\set ON_ERROR_STOP 0
\set QUIET on
UPDATE private.app_flags SET enabled = false WHERE key = 'student_gate'; -- these checks predate the student gate (test_gate.sql covers it)
-- A, B, C players; D will be blocked by A; E is disabled.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Άννα Παπά"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Χρήστος"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x', '{"full_name":"Eve"}');
UPDATE public.profiles SET disabled = true WHERE id = '00000000-0000-0000-0000-00000000000e';

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN coalesce(cond, false) THEN 'PASS' ELSE 'FAIL' END, label; END $$;
CREATE FUNCTION pg_temp.fails(stmt text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''
\set E '''00000000-0000-0000-0000-00000000000e'''

-- 01 profiles
SELECT pg_temp.ok('01a usernames generated (Greek → Latin)',
  (SELECT username FROM public.profiles WHERE id = :A) = 'anna.papa'
  AND (SELECT username FROM public.profiles WHERE id = :C) = 'christos');
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('01b can rename self', NOT pg_temp.fails($$UPDATE public.profiles SET username = 'anna' WHERE id = auth.uid()$$));
SELECT pg_temp.ok('01c bad username rejected', pg_temp.fails($$UPDATE public.profiles SET username = 'A B' WHERE id = auth.uid()$$));
SELECT pg_temp.ok('01d cannot touch system columns', pg_temp.fails($$UPDATE public.profiles SET disabled = false WHERE id = auth.uid()$$));
UPDATE public.profiles SET full_name = 'hacked' WHERE id = '00000000-0000-0000-0000-00000000000b';
SELECT pg_temp.ok('01e cannot edit others', (SELECT full_name FROM public.profiles WHERE id = :B) = 'Bob');
SELECT pg_temp.ok('01f avatar must be in own folder', pg_temp.fails($$UPDATE public.profiles SET avatar_path = 'someone/x.jpg' WHERE id = auth.uid()$$));
SELECT pg_temp.ok('01g disabled profile hidden', NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :E));
SELECT pg_temp.ok('01h search by Greek name and by username',
  EXISTS (SELECT 1 FROM public.search_users('Χρήστ') WHERE id = :C) AND EXISTS (SELECT 1 FROM public.search_users('bo') WHERE id = :B));
RESET ROLE;

-- 02 voice DMs need mutual follows
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.follow_user(:B);
SELECT pg_temp.ok('02a one-way follow cannot DM', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'audio/mp4', 2000)$$));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.follow_user(:A);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('02b bad mime rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'text/html', 2000)$$));
SELECT pg_temp.ok('02c too long rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'audio/mp4', 61000)$$));
SELECT pg_temp.ok('02d too big rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 2200000), 'UTF8'), 'base64'), 'audio/mp4', 2000)$$));
SELECT public.send_voice_message(:B, encode(convert_to(repeat('v', 500), 'UTF8'), 'base64'), 'audio/mp4;codecs=mp4a.40.2', 2500) AS m1 \gset
SELECT pg_temp.ok('02e audio table unreachable', pg_temp.fails($$SELECT * FROM private.voice_message_audio$$));
SELECT pg_temp.ok('02f sender cannot consume', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m1')));
SELECT pg_temp.ok('02g no direct update of opened_at', pg_temp.fails(format('UPDATE public.voice_messages SET opened_at = now() WHERE id = %L', :'m1')));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02h inbox shows 1 unheard', (SELECT unheard FROM public.my_threads() WHERE other_id = :A) = 1);
SELECT pg_temp.ok('02i consume returns the audio (no line breaks)',
  (SELECT convert_from(decode(audio_b64, 'base64'), 'UTF8') = repeat('v', 500) AND mime = 'audio/mp4' AND duration_ms = 2500
     AND position(E'\n' in audio_b64) = 0
   FROM public.consume_voice_message(:'m1')));
SELECT pg_temp.ok('02j second listen fails', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m1')));
RESET ROLE;
SELECT pg_temp.ok('02k audio bytes deleted', NOT EXISTS (SELECT 1 FROM private.voice_message_audio WHERE message_id = :'m1'));
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('02l sender sees opened', (SELECT last_state FROM public.my_threads() WHERE other_id = :B) = 'opened');
SELECT public.send_voice_message(:B, encode(convert_to(repeat('w', 500), 'UTF8'), 'base64'), 'audio/mp4', 1500) AS m2 \gset
RESET ROLE;
UPDATE public.voice_messages SET created_at = now() - interval '11 days' WHERE id = :'m2';
SELECT private.expire_voice_messages();
SELECT pg_temp.ok('02m unheard after 10 days expires (row kept, audio gone)',
  (SELECT expired_at IS NOT NULL FROM public.voice_messages WHERE id = :'m2')
  AND NOT EXISTS (SELECT 1 FROM private.voice_message_audio WHERE message_id = :'m2'));
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02n expired cannot be played', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m2')));
RESET ROLE;

-- 03 daily prompt schedule
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('03a prompt schedule: 30 days, 10:00–21:00 Athens',
  (SELECT count(*) = 30 AND bool_and((prompt_at AT TIME ZONE 'Europe/Athens')::time BETWEEN '10:00' AND '20:59')
   FROM public.prompt_schedule(30)));
SELECT pg_temp.ok('03b today() gives the next prompt', (SELECT next_prompt_at > now() FROM public.today()));
RESET ROLE;

-- 04 blocks
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.follow_user(:A);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.follow_user(:D);
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.send_voice_message(:A, encode(convert_to(repeat('d', 500), 'UTF8'), 'base64'), 'audio/mp4', 1500) AS md \gset
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.block_user(:D);
SELECT pg_temp.ok('04a block ends follows both ways', NOT EXISTS (SELECT 1 FROM public.follows WHERE :D IN (follower_id, followee_id)));
SELECT pg_temp.ok('04b their unheard messages dropped', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'md')));
SELECT pg_temp.ok('04c listed in my_blocked', EXISTS (SELECT 1 FROM public.my_blocked() WHERE id = :D));
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('04d blocked user cannot follow again', pg_temp.fails($$SELECT public.follow_user('00000000-0000-0000-0000-00000000000a')$$));
SELECT pg_temp.ok('04e blocked user cannot find blocker', NOT EXISTS (SELECT 1 FROM public.search_users('ann'))
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :A));
SELECT pg_temp.ok('04f blocked user cannot see who blocked them', NOT EXISTS (SELECT 1 FROM public.blocks));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.unblock_user(:D);
SELECT pg_temp.ok('04g unblock', NOT EXISTS (SELECT 1 FROM public.my_blocked()));
RESET ROLE;

-- 05 reports
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('05a report received message', NOT pg_temp.fails(format($$SELECT public.report_content('voice_message', %L, 'abuse')$$, :'m1')));
SELECT pg_temp.ok('05b cannot report a message you did not receive', pg_temp.fails(format($$SELECT public.report_content('voice_message', %L)$$, :'md')));
SELECT pg_temp.ok('05c reports not readable by clients', pg_temp.fails($$SELECT * FROM public.reports$$));
SELECT pg_temp.ok('05d report a user', NOT pg_temp.fails($$SELECT public.report_content('user', '00000000-0000-0000-0000-00000000000c', 'spam')$$));
RESET ROLE;

-- 06 anonymous and disabled callers
SET ROLE anon;
SELECT pg_temp.ok('06a anon cannot read profiles', pg_temp.fails($$SELECT * FROM public.profiles$$));
SELECT pg_temp.ok('06b anon cannot call RPCs', pg_temp.fails($$SELECT * FROM public.search_users('an')$$));
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('06c disabled user cannot act', pg_temp.fails($$SELECT public.follow_user('00000000-0000-0000-0000-00000000000a')$$));
RESET ROLE;

-- 07 rate limit (follows: 200/hour)
SELECT pg_temp.as_user(:C);
INSERT INTO private.rate_events (user_id, action) SELECT :C, 'follow' FROM generate_series(1, 200);
SET ROLE authenticated;
SELECT pg_temp.ok('07a follow rate limited', pg_temp.fails($$SELECT public.follow_user('00000000-0000-0000-0000-00000000000b')$$));
RESET ROLE;

-- 08 account deletion cascades
DELETE FROM auth.users WHERE id = :B;
SELECT pg_temp.ok('08a deleting the account removes everything',
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :B)
  AND NOT EXISTS (SELECT 1 FROM public.voice_messages WHERE :B IN (sender_id, recipient_id))
  AND NOT EXISTS (SELECT 1 FROM public.follows WHERE :B IN (follower_id, followee_id)));
