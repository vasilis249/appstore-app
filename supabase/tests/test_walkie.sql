-- Walkie-talkie: who may join / send on a live channel, saving and replaying transmissions for 24 h.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}');
-- Anna and Bob are friends (mutual follows); Chris only follows Anna.
INSERT INTO public.follows (follower_id, followee_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a');

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN coalesce(cond, false) THEN 'PASS' ELSE 'FAIL' END, label; END $$;
CREATE FUNCTION pg_temp.fails(stmt text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;
-- Realtime's check: can the current user SELECT (join/receive) / INSERT (send) on this topic?
CREATE FUNCTION pg_temp.rt(p_topic text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE pid bigint; r boolean; w boolean := true;
BEGIN
  PERFORM set_config('realtime.topic', p_topic, true);
  pid := realtime.probe(p_topic);
  SELECT EXISTS (SELECT 1 FROM realtime.messages WHERE id = pid) INTO r;
  BEGIN
    INSERT INTO realtime.messages (topic, extension, private) VALUES (p_topic, 'broadcast', true);
  EXCEPTION WHEN OTHERS THEN w := false; END;
  RETURN CASE WHEN r THEN 'r' ELSE '-' END || CASE WHEN w THEN 'w' ELSE '-' END;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set AB '''walkie:00000000-0000-0000-0000-00000000000a:00000000-0000-0000-0000-00000000000b'''
\set BA '''walkie:00000000-0000-0000-0000-00000000000b:00000000-0000-0000-0000-00000000000a'''
\set AC '''walkie:00000000-0000-0000-0000-00000000000a:00000000-0000-0000-0000-00000000000c'''
SELECT set_config('app.b64', encode(convert_to(repeat('voice', 60), 'UTF8'), 'base64'), false);

-- 01 live channel authorization
SELECT pg_temp.ok('01a topic name is canonical', private.walkie_topic(:B, :A) = :AB);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('01b a friend may join and send', pg_temp.rt(:AB) = 'rw');
SELECT pg_temp.ok('01c nobody sends on the reversed name (the old rule only lets its last id read)', pg_temp.rt(:BA) = 'r-');
SELECT pg_temp.ok('01d not with a one-way follower', pg_temp.rt(:AC) = '--');
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('01e the other friend too', pg_temp.rt(:AB) = 'rw');
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('01f an outsider can neither listen nor send', pg_temp.rt(:AB) = '--');
SELECT pg_temp.ok('01g other topics keep the existing rule (own-id topics readable, not writable)',
  pg_temp.rt('notes:00000000-0000-0000-0000-00000000000c') = 'r-');
RESET ROLE;

-- 02 saving and replaying
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.send_walkie(:B, current_setting('app.b64'), 'audio/mp4', 4200) AS m1 \gset
SELECT pg_temp.ok('02a send to a friend',
  (SELECT count(*) FROM public.walkie_history(:B)) = 1 AND (SELECT duration_ms FROM public.walkie_history(:B)) = 4200);
SELECT pg_temp.ok('02b not to a non-friend', pg_temp.fails(format($$SELECT public.send_walkie(%L, current_setting('app.b64'), 'audio/mp4', 1000)$$, :C)));
SELECT pg_temp.ok('02c too long / too short audio refused',
  pg_temp.fails(format($$SELECT public.send_walkie(%L, encode('x', 'base64'), 'audio/mp4', 1000)$$, :B)));
SELECT pg_temp.ok('02d no direct writes', pg_temp.fails(format($$INSERT INTO public.walkie_messages (sender_id, recipient_id, duration_ms) VALUES (%L, %L, 1000)$$, :A, :B)));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02e the friend replays it (as often as they like)',
  (SELECT audio_b64 FROM public.walkie_audio(:'m1')) = current_setting('app.b64')
  AND (SELECT audio_b64 FROM public.walkie_audio(:'m1')) = current_setting('app.b64')
  AND (SELECT mime FROM public.walkie_audio(:'m1')) = 'audio/mp4');
SELECT pg_temp.ok('02f history is the same from both sides', (SELECT sender_id FROM public.walkie_history(:A)) = :A);
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('02g outsiders see nothing',
  NOT EXISTS (SELECT 1 FROM public.walkie_audio(:'m1')) AND NOT EXISTS (SELECT 1 FROM public.walkie_messages)
  AND NOT EXISTS (SELECT 1 FROM public.walkie_history(:A)));
RESET ROLE;

-- 03 24 hours, blocks
UPDATE public.walkie_messages SET created_at = now() - interval '25 hours' WHERE id = :'m1';
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('03a older than 24 h: not listed, not playable',
  NOT EXISTS (SELECT 1 FROM public.walkie_history(:A)) AND NOT EXISTS (SELECT 1 FROM public.walkie_audio(:'m1')));
RESET ROLE;
SELECT private.expire_walkie();
SELECT pg_temp.ok('03b the hourly job deletes it, audio too',
  NOT EXISTS (SELECT 1 FROM public.walkie_messages) AND NOT EXISTS (SELECT 1 FROM private.walkie_audio));
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.send_walkie(:B, current_setting('app.b64'), 'audio/mp4', 2000);
SELECT public.block_user(:B);
SELECT pg_temp.ok('03c blocking ends the channel and wipes the history',
  pg_temp.rt(:AB) = '--' AND NOT EXISTS (SELECT 1 FROM public.walkie_history(:B))
  AND pg_temp.fails(format($$SELECT public.send_walkie(%L, current_setting('app.b64'), 'audio/mp4', 1000)$$, :B)));
RESET ROLE;
SELECT pg_temp.ok('03d nothing left in the table', NOT EXISTS (SELECT 1 FROM public.walkie_messages));
SET ROLE anon;
SELECT pg_temp.ok('03e anon: nothing', pg_temp.fails($$SELECT public.walkie_history('00000000-0000-0000-0000-00000000000a')$$)
  AND pg_temp.fails('SELECT * FROM public.walkie_messages'));
RESET ROLE;
