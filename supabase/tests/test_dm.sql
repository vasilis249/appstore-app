\set ON_ERROR_STOP 0
-- D1 public, D2 private (D1 does not follow), D3 blocked by D1
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test', '{"full_name":"Dim One"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test', '{"full_name":"Dim Two"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@test', '{"full_name":"Dim Three"}');
UPDATE public.profiles SET is_private = true WHERE user_id = '00000000-0000-0000-0000-0000000000d2';
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3');
CREATE OR REPLACE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN cond THEN 'PASS' ELSE 'FAIL' END, label; END $$;

-- Conversations as the server would create them (D2 not following D1 -> request)
INSERT INTO public.conversations (id, type, created_by) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'direct', '00000000-0000-0000-0000-0000000000d1'),
  ('cccccccc-0000-0000-0000-000000000002', 'direct', '00000000-0000-0000-0000-0000000000d3');
INSERT INTO public.conversation_members (conversation_id, user_id, role, accepted) VALUES
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 'admin', true),
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2', 'member', false),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d3', 'admin', true),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d1', 'member', true);
INSERT INTO public.posts (id, author_id, caption, media) VALUES
  ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2', 'private post', ARRAY['x/1.jpg']),
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d1', 'public post', ARRAY['x/2.jpg']);

-- 01 empty request is hidden from the recipient
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d2'); SET ROLE authenticated;
SELECT pg_temp.ok('01 empty request hidden', NOT EXISTS (SELECT 1 FROM public.my_inbox()));
RESET ROLE;

-- 02 sender writes; recipient sees it under requests with unread = 1
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1'); SET ROLE authenticated;
INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), 'Γεια!');
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d2'); SET ROLE authenticated;
SELECT pg_temp.ok('02 request listed, unread 1', (SELECT NOT accepted AND unread = 1 AND last_body = 'Γεια!' FROM public.my_inbox()));
-- 03 recipient cannot self-accept via direct UPDATE (no grant)
DO $$ BEGIN
  UPDATE public.conversation_members SET accepted = true WHERE user_id = auth.uid();
  RAISE NOTICE 'FAIL 03 direct accept allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03 direct accept blocked';
END $$;
DO $$ BEGIN
  UPDATE public.conversation_members SET role = 'admin' WHERE user_id = auth.uid();
  RAISE NOTICE 'FAIL 03b role escalation allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03b role escalation blocked';
END $$;
DO $$ BEGIN
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d3');
  RAISE NOTICE 'FAIL 03c member insert allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03c member insert blocked';
END $$;
-- 04 replying accepts the request and marks read
INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), 'Γεια σου');
SELECT pg_temp.ok('04 reply accepts', (SELECT accepted AND unread = 0 FROM public.my_inbox()));
RESET ROLE;

-- 05 blocked pair cannot message
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d3'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000002', auth.uid(), 'hi');
  RAISE NOTICE 'FAIL 05 blocked message allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 05 blocked message rejected';
END $$;
RESET ROLE;

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1'); SET ROLE authenticated;
-- 06 empty body without reference rejected
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), '   ');
  RAISE NOTICE 'FAIL 06 empty message allowed';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 06 empty message rejected';
END $$;
-- 07 sharing a post the sender cannot see is rejected
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body, post_id) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), '', 'dddddddd-0000-0000-0000-000000000001');
  RAISE NOTICE 'FAIL 07 invisible post shared';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 07 invisible post rejected';
END $$;
-- 08 sharing own public post works with empty body
INSERT INTO public.messages (conversation_id, sender_id, body, post_id) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), '', 'dddddddd-0000-0000-0000-000000000002');
SELECT pg_temp.ok('08 post share ok', (SELECT last_kind = 'post' FROM public.my_inbox() WHERE id = 'cccccccc-0000-0000-0000-000000000001'));
-- 09 forged created_at / deleted_at ignored
INSERT INTO public.messages (conversation_id, sender_id, body, created_at, deleted_at) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), 'x', now() + interval '1 year', now());
SELECT pg_temp.ok('09 created_at/deleted_at reset', (SELECT created_at <= now() AND deleted_at IS NULL FROM public.messages WHERE body = 'x'));
-- 10 rate limit
DO $$ BEGIN
  FOR i IN 1..40 LOOP
    INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), 'spam ' || i);
  END LOOP;
  RAISE NOTICE 'FAIL 10 no rate limit';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 10 rate limited';
END $$;
-- 11 not a member: cannot read or write
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d3'); SET ROLE authenticated;
SELECT pg_temp.ok('11a outsider sees no messages', NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = 'cccccccc-0000-0000-0000-000000000001'));
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body) VALUES ('cccccccc-0000-0000-0000-000000000001', auth.uid(), 'intrude');
  RAISE NOTICE 'FAIL 11b outsider insert allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 11b outsider insert blocked';
END $$;
RESET ROLE;

-- 12 mentions: public mention notifies; private user who can't see the post is skipped; blocked skipped
UPDATE public.profiles SET username = 'dim.one' WHERE user_id = '00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET username = 'dim.two' WHERE user_id = '00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET username = 'dim.three' WHERE user_id = '00000000-0000-0000-0000-0000000000d3';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d2'); SET ROLE authenticated;
INSERT INTO public.posts (id, author_id, caption, media) VALUES
  ('dddddddd-0000-0000-0000-000000000003', auth.uid(), 'με @dim.one και @dim.three και @dim.two', ARRAY[auth.uid()::text || '/3.jpg']);
RESET ROLE;
SELECT pg_temp.ok('12a private post: nobody who cannot view it is notified',
  NOT EXISTS (SELECT 1 FROM public.notifications WHERE type = 'mention' AND data->>'post_id' = 'dddddddd-0000-0000-0000-000000000003'));
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d3'); SET ROLE authenticated;
INSERT INTO public.post_comments (post_id, author_id, body) VALUES ('dddddddd-0000-0000-0000-000000000002', auth.uid(), 'hey @dim.one');
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1'); SET ROLE authenticated;
INSERT INTO public.post_comments (post_id, author_id, body) VALUES ('dddddddd-0000-0000-0000-000000000002', auth.uid(), 'ping @dim.two @dim.three @dim.one');
RESET ROLE;
SELECT pg_temp.ok('12b mentions: ' || COALESCE(string_agg(user_id::text, ',' ORDER BY user_id), 'none'),
  count(*) = 1 AND bool_and(user_id = '00000000-0000-0000-0000-0000000000d2'))
FROM public.notifications WHERE type = 'mention';
