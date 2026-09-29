-- Voice baseline: friends, listen-once DMs, daily posts + unlock, blocks, reports, privileges.
\set ON_ERROR_STOP 0
\set QUIET on
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
-- true when the statement raises
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
SELECT pg_temp.ok('01d cannot un-disable / touch system columns', pg_temp.fails($$UPDATE public.profiles SET disabled = false WHERE id = auth.uid()$$));
UPDATE public.profiles SET full_name = 'hacked' WHERE id = '00000000-0000-0000-0000-00000000000b';
SELECT pg_temp.ok('01e cannot edit others', (SELECT full_name FROM public.profiles WHERE id = :B) = 'Bob');
SELECT pg_temp.ok('01f avatar must be in own folder', pg_temp.fails($$UPDATE public.profiles SET avatar_path = 'someone/x.jpg' WHERE id = auth.uid()$$));
SELECT pg_temp.ok('01g disabled profile hidden', NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :E));

-- 02 friends
SELECT pg_temp.ok('02a no direct insert', pg_temp.fails($$INSERT INTO public.friendships (user_a, user_b, requested_by, status)
  VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted')$$));
SELECT pg_temp.ok('02b cannot befriend self', pg_temp.fails($$SELECT public.send_friend_request(auth.uid())$$));
SELECT pg_temp.ok('02c cannot befriend disabled', pg_temp.fails($$SELECT public.send_friend_request('00000000-0000-0000-0000-00000000000e')$$));
SELECT pg_temp.ok('02d request sent', public.send_friend_request(:B) = 'outgoing');
SELECT pg_temp.ok('02e2 search ignores dots', EXISTS (SELECT 1 FROM public.search_users('christ') WHERE id = :C)
  AND (SELECT count(*) FROM public.search_users('anna')) = 0);
SELECT pg_temp.ok('02e search shows outgoing',
  (SELECT relation FROM public.search_users('bo') WHERE id = :B) = 'outgoing');
SELECT pg_temp.ok('02f requester cannot accept own request', pg_temp.fails($$SELECT public.accept_friend_request('00000000-0000-0000-0000-00000000000b')$$));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02g recipient notified', EXISTS (SELECT 1 FROM public.notifications WHERE actor_id = :A AND kind = 'friend_request'));
SELECT pg_temp.ok('02h incoming listed', (SELECT relation FROM public.my_friends() WHERE id = :A) = 'incoming');
SELECT public.accept_friend_request(:A);
SELECT pg_temp.ok('02i accepted', (SELECT relation FROM public.my_friends() WHERE id = :A) = 'friends');
SELECT pg_temp.ok('02j notifications: only read_at editable',
  pg_temp.fails($$UPDATE public.notifications SET kind = 'friend_accepted'$$)
  AND NOT pg_temp.fails($$UPDATE public.notifications SET read_at = now()$$));
-- C asks A, A later accepts by sending a request back
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.send_friend_request(:A);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('02k mutual request = friends', public.send_friend_request(:C) = 'friends');
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('02l others cannot see A–B friendship', NOT EXISTS (SELECT 1 FROM public.friendships));

-- 03 voice DMs (listen once)
SELECT pg_temp.ok('03a non-friend cannot send', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000a', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'audio/mp4', 2000)$$));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('03b bad mime rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'text/html', 2000)$$));
SELECT pg_temp.ok('03c too long rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 500), 'UTF8'), 'base64'), 'audio/mp4', 61000)$$));
SELECT pg_temp.ok('03d too big rejected', pg_temp.fails(
  $$SELECT public.send_voice_message('00000000-0000-0000-0000-00000000000b', encode(convert_to(repeat('x', 2200000), 'UTF8'), 'base64'), 'audio/mp4', 2000)$$));
SELECT public.send_voice_message(:B, encode(convert_to(repeat('v', 500), 'UTF8'), 'base64'), 'audio/mp4;codecs=mp4a.40.2', 2500) AS m1 \gset
SELECT pg_temp.ok('03e audio table unreachable', pg_temp.fails($$SELECT * FROM private.voice_message_audio$$));
SELECT pg_temp.ok('03f sender cannot consume', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m1')));
SELECT pg_temp.ok('03g no direct update of opened_at', pg_temp.fails(format('UPDATE public.voice_messages SET opened_at = now() WHERE id = %L', :'m1')));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('03h inbox shows 1 unheard', (SELECT unheard FROM public.my_threads() WHERE other_id = :A) = 1);
SELECT pg_temp.ok('03i consume returns the audio',
  (SELECT convert_from(decode(audio_b64, 'base64'), 'UTF8') = repeat('v', 500) AND mime = 'audio/mp4' AND duration_ms = 2500
     AND position(E'\n' in audio_b64) = 0
   FROM public.consume_voice_message(:'m1')));
SELECT pg_temp.ok('03j second listen fails', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m1')));
RESET ROLE;
SELECT pg_temp.ok('03k audio bytes deleted', NOT EXISTS (SELECT 1 FROM private.voice_message_audio WHERE message_id = :'m1'));
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('03l sender sees opened', (SELECT last_state FROM public.my_threads() WHERE other_id = :B) = 'opened');
SELECT public.send_voice_message(:B, encode(convert_to(repeat('w', 500), 'UTF8'), 'base64'), 'audio/mp4', 1500) AS m2 \gset
RESET ROLE;
UPDATE public.voice_messages SET created_at = now() - interval '11 days' WHERE id = :'m2';
SELECT private.expire_voice_messages();
SELECT pg_temp.ok('03m unheard after 10 days expires (row kept, audio gone)',
  (SELECT expired_at IS NOT NULL FROM public.voice_messages WHERE id = :'m2')
  AND NOT EXISTS (SELECT 1 FROM private.voice_message_audio WHERE message_id = :'m2'));
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('03n expired cannot be played', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'m2')));
RESET ROLE;

-- 04 daily posts + unlock
SELECT pg_temp.ok('04a prompt schedule: 30 days, 10:00–21:00 Athens',
  (SELECT count(*) = 30 AND bool_and((prompt_at AT TIME ZONE 'Europe/Athens')::time BETWEEN '10:00' AND '20:59')
   FROM public.prompt_schedule(30)));
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('daily-posts', '00000000-0000-0000-0000-00000000000b/p1.m4a'),
  ('daily-posts', '00000000-0000-0000-0000-00000000000a/p1.m4a'),
  ('daily-posts', '00000000-0000-0000-0000-00000000000d/p1.m4a');
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('04b needs an uploaded file', pg_temp.fails($$SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000b/nope.m4a', 'audio/mp4', 5000)$$));
SELECT pg_temp.ok('04c cannot publish someone else''s file', pg_temp.fails($$SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000a/p1.m4a', 'audio/mp4', 5000)$$));
SELECT pg_temp.ok('04d over 90 s rejected', pg_temp.fails($$SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000b/p1.m4a', 'audio/mp4', 91000)$$));
SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000b/p1.m4a', 'audio/mp4', 5000) AS pb \gset
SELECT pg_temp.ok('04e one post per moment', pg_temp.fails($$SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000b/p1.m4a', 'audio/mp4', 5000)$$));
SELECT pg_temp.ok('04f today() unlocked after posting', (SELECT unlocked AND my_post_id = :'pb' FROM public.today()));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('04g friend post listed but locked', (SELECT audio_path IS NULL FROM public.feed() WHERE post_id = :'pb'));
SELECT pg_temp.ok('04h locked file not readable', NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000b/p1.m4a'));
SELECT public.publish_daily_post('00000000-0000-0000-0000-00000000000a/p1.m4a', 'audio/mp4', 4000) AS pa \gset
SELECT pg_temp.ok('04i unlocked after own post', (SELECT audio_path IS NOT NULL FROM public.feed() WHERE post_id = :'pb'));
SELECT pg_temp.ok('04j friend file readable', EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000b/p1.m4a'));
SELECT pg_temp.ok('04k cannot upload into another folder', pg_temp.fails(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('daily-posts', '00000000-0000-0000-0000-00000000000b/evil.m4a')$$));
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('04l non-friend of B sees nothing of B', NOT EXISTS (SELECT 1 FROM public.feed() WHERE user_id = :B)
  AND NOT EXISTS (SELECT 1 FROM public.daily_posts WHERE user_id = :B));
RESET ROLE;
UPDATE public.daily_posts SET created_at = now() - interval '25 hours' WHERE id = :'pb';
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('04m older than 24 h disappears for friends', NOT EXISTS (SELECT 1 FROM public.feed() WHERE post_id = :'pb')
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000b/p1.m4a'));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('04n own history stays (calendar)', EXISTS (SELECT 1 FROM public.daily_posts WHERE id = :'pb')
  AND EXISTS (SELECT 1 FROM storage.objects WHERE name = '00000000-0000-0000-0000-00000000000b/p1.m4a'));
SELECT pg_temp.ok('04o can delete own post', NOT pg_temp.fails(format('DELETE FROM public.daily_posts WHERE id = %L', :'pb')));
RESET ROLE;

-- 05 blocks
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.send_friend_request(:A);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.accept_friend_request(:D);
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.send_voice_message(:A, encode(convert_to(repeat('d', 500), 'UTF8'), 'base64'), 'audio/mp4', 1500) AS md \gset
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.block_user(:D);
SELECT pg_temp.ok('05a block ends friendship', NOT EXISTS (SELECT 1 FROM public.my_friends() WHERE id = :D));
SELECT pg_temp.ok('05b their unheard messages dropped', pg_temp.fails(format('SELECT * FROM public.consume_voice_message(%L)', :'md')));
SELECT pg_temp.ok('05c listed in my_blocked', EXISTS (SELECT 1 FROM public.my_blocked() WHERE id = :D));
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('05d blocked user cannot request again', pg_temp.fails($$SELECT public.send_friend_request('00000000-0000-0000-0000-00000000000a')$$));
SELECT pg_temp.ok('05e blocked user cannot find blocker', NOT EXISTS (SELECT 1 FROM public.search_users('ann'))
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :A));
SELECT pg_temp.ok('05f blocked user cannot see who blocked them', NOT EXISTS (SELECT 1 FROM public.blocks));
RESET ROLE;

-- 06 reports
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('06a report received message', NOT pg_temp.fails(format($$SELECT public.report_content('voice_message', %L, 'abuse')$$, :'m1')));
SELECT pg_temp.ok('06b cannot report a message you did not receive', pg_temp.fails(format($$SELECT public.report_content('voice_message', %L)$$, :'md')));
SELECT pg_temp.ok('06c reports not readable by clients', pg_temp.fails($$SELECT * FROM public.reports$$));
RESET ROLE;

-- 07 anonymous and disabled callers
SET ROLE anon;
SELECT pg_temp.ok('07a anon cannot read profiles', pg_temp.fails($$SELECT * FROM public.profiles$$));
SELECT pg_temp.ok('07b anon cannot call RPCs', pg_temp.fails($$SELECT * FROM public.search_users('an')$$));
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('07c disabled user cannot act', pg_temp.fails($$SELECT public.send_friend_request('00000000-0000-0000-0000-00000000000a')$$));
RESET ROLE;

-- 08 rate limit (friend requests: 50/hour)
SELECT pg_temp.as_user(:C);
INSERT INTO private.rate_events (user_id, action) SELECT :C, 'friend_request' FROM generate_series(1, 50);
SET ROLE authenticated;
SELECT pg_temp.ok('08a friend request rate limited', pg_temp.fails($$SELECT public.send_friend_request('00000000-0000-0000-0000-00000000000b')$$));
RESET ROLE;

-- 09 account deletion cascades
DELETE FROM auth.users WHERE id = :B;
SELECT pg_temp.ok('09a deleting the account removes everything',
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :B)
  AND NOT EXISTS (SELECT 1 FROM public.voice_messages WHERE :B IN (sender_id, recipient_id))
  AND NOT EXISTS (SELECT 1 FROM public.friendships WHERE :B IN (user_a, user_b))
  AND NOT EXISTS (SELECT 1 FROM public.daily_posts WHERE user_id = :B));
