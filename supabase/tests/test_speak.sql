-- Speak: follows, sections/topics, posts (replies, reposts, quotes), likes, listens, feeds, admin, visibility.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x', '{"full_name":"Eve"}');
INSERT INTO private.admins (user_id) VALUES ('00000000-0000-0000-0000-00000000000e');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('voices', '00000000-0000-0000-0000-00000000000a/a1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000a/a2.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000b/b1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000b/b2.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000c/c1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000d/d1.m4a');

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

-- 01 sections
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('01a eight sections', (SELECT count(*) FROM public.sections) = 8);
SELECT pg_temp.ok('01b clients cannot add sections', pg_temp.fails($$INSERT INTO public.sections VALUES ('x', 9, 'x', 'x', 'x')$$));
RESET ROLE; SET ROLE anon;
SELECT pg_temp.ok('01c anon sees nothing', pg_temp.fails($$SELECT * FROM public.posts$$) AND pg_temp.fails($$SELECT public.feed_posts('all')$$));
RESET ROLE;

-- 02 follows
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('02a cannot follow self', pg_temp.fails($$SELECT public.follow_user(auth.uid())$$));
SELECT pg_temp.ok('02b no direct insert', pg_temp.fails($$INSERT INTO public.follows VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')$$));
SELECT public.follow_user(:B);
SELECT public.follow_user(:B);
SELECT pg_temp.ok('02c follow is idempotent', (SELECT count(*) FROM public.follows WHERE follower_id = :A) = 1);
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02d stats: followers + follows_me', (SELECT followers FROM public.profile_stats(:B::uuid)) = 1
  AND (SELECT follows_me AND NOT i_follow FROM public.profile_stats(:A::uuid)));
SELECT public.follow_user(:C);
SELECT public.remove_follower(:A);
SELECT pg_temp.ok('02e remove follower', NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = :A AND followee_id = :B));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.follow_user(:B);
RESET ROLE;

-- 03 posts
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.admin_create_topic('tech', 'iPhone 18 launched', 'Apple event', 'Example', 'https://example.com/a') AS t1 \gset
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('03a non-admin cannot create topics', pg_temp.fails($$SELECT public.admin_create_topic('tech', 'Nope topic')$$));
SELECT pg_temp.ok('03b file must be uploaded', pg_temp.fails($$SELECT public.create_post('tech', NULL, NULL, NULL, 'x', '00000000-0000-0000-0000-00000000000a/none.m4a', 'audio/mp4', 5000)$$));
SELECT pg_temp.ok('03c not someone else''s file', pg_temp.fails($$SELECT public.create_post('tech', NULL, NULL, NULL, 'x', '00000000-0000-0000-0000-00000000000b/b1.m4a', 'audio/mp4', 5000)$$));
SELECT pg_temp.ok('03d max 2 minutes', pg_temp.fails($$SELECT public.create_post('tech', NULL, NULL, NULL, 'x', '00000000-0000-0000-0000-00000000000a/a1.m4a', 'audio/mp4', 121000)$$));
SELECT pg_temp.ok('03e unknown section', pg_temp.fails($$SELECT public.create_post('cooking', NULL, NULL, NULL, 'x', '00000000-0000-0000-0000-00000000000a/a1.m4a', 'audio/mp4', 5000)$$));
SELECT public.create_post(NULL, :'t1', NULL, NULL, 'My take on the iPhone', '00000000-0000-0000-0000-00000000000a/a1.m4a', 'audio/mp4', 30000) AS pa \gset
SELECT pg_temp.ok('03f topic sets the section + counter', (SELECT section_id FROM public.posts WHERE id = :'pa') = 'tech'
  AND (SELECT posts_count FROM public.topics WHERE id = :'t1') = 1);
SELECT pg_temp.ok('03g counters not writable', pg_temp.fails(format('UPDATE public.posts SET likes_count = 999 WHERE id = %L', :'pa')));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.create_post('sports', NULL, :'pa', NULL, NULL, '00000000-0000-0000-0000-00000000000b/b1.m4a', 'audio/mp4', 8000) AS rb \gset
SELECT pg_temp.ok('03h reply inherits section/topic, counts', (SELECT section_id = 'tech' AND topic_id = :'t1' FROM public.posts WHERE id = :'rb')
  AND (SELECT replies_count FROM public.posts WHERE id = :'pa') = 1
  AND (SELECT posts_count FROM public.topics WHERE id = :'t1') = 1);
SELECT public.create_post(NULL, NULL, NULL, :'pa') AS rp \gset
SELECT pg_temp.ok('03i plain repost', (SELECT reposts_count FROM public.posts WHERE id = :'pa') = 1);
SELECT pg_temp.ok('03j only one plain repost', pg_temp.fails(format('SELECT public.create_post(NULL, NULL, NULL, %L)', :'pa')));
SELECT pg_temp.ok('03k cannot repost a repost', pg_temp.fails(format('SELECT public.create_post(NULL, NULL, NULL, %L)', :'rp')));
SELECT public.create_post(NULL, NULL, NULL, :'pa', 'Quote', '00000000-0000-0000-0000-00000000000b/b2.m4a', 'audio/mp4', 4000) AS qb \gset
SELECT pg_temp.ok('03l quote with voice', (SELECT reposts_count FROM public.posts WHERE id = :'pa') = 2);
SELECT public.unrepost(:'pa');
SELECT pg_temp.ok('03m unrepost', (SELECT reposts_count FROM public.posts WHERE id = :'pa') = 1);
SELECT pg_temp.ok('03n cannot delete others'' posts', (SELECT count(*) FROM public.posts WHERE id = :'pa') = 1
  AND NOT pg_temp.fails(format('DELETE FROM public.posts WHERE id = %L', :'pa'))
  AND (SELECT count(*) FROM public.posts WHERE id = :'pa') = 1);
RESET ROLE;

-- 04 likes + listens
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.like_post(:'pa'); SELECT public.like_post(:'pa');
SELECT pg_temp.ok('04a like counted once', (SELECT likes_count FROM public.posts WHERE id = :'pa') = 1);
SELECT public.record_listen(:'pa'); SELECT public.record_listen(:'pa');
SELECT pg_temp.ok('04b listen counted once per person', (SELECT listens_count FROM public.posts WHERE id = :'pa') = 1);
SELECT pg_temp.ok('04c feed shows liked flag', (SELECT liked FROM public.feed_posts('topic', NULL, :'t1') WHERE post_id = :'pa'));
SELECT public.unlike_post(:'pa');
SELECT pg_temp.ok('04d unlike', (SELECT likes_count FROM public.posts WHERE id = :'pa') = 0);
SELECT pg_temp.ok('04e listens table closed', pg_temp.fails($$SELECT * FROM public.post_listens$$));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.record_listen(:'pa');
SELECT pg_temp.ok('04f author''s own listen not counted', (SELECT listens_count FROM public.posts WHERE id = :'pa') = 1);
RESET ROLE;

-- 05 feeds
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.create_post('humor', NULL, NULL, NULL, 'Chris joke', '00000000-0000-0000-0000-00000000000c/c1.m4a', 'audio/mp4', 3000) AS pc \gset
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('05a following = me + people I follow (no replies)',
  NOT EXISTS (SELECT 1 FROM public.feed_posts('following') WHERE author_id NOT IN (:A, :B) OR reply_to IS NOT NULL)
  AND EXISTS (SELECT 1 FROM public.feed_posts('following') WHERE author_id = :B));
SELECT pg_temp.ok('05b all has everyone''s top-level posts', (SELECT count(*) FROM public.feed_posts('all')) = 3);
SELECT pg_temp.ok('05c section', (SELECT count(*) = 1 AND bool_and(section_id = 'humor') FROM public.feed_posts('section', 'humor')));
SELECT pg_temp.ok('05d topic', (SELECT count(*) FROM public.feed_posts('topic', NULL, :'t1')) = 1);
SELECT pg_temp.ok('05e replies of a post', (SELECT count(*) FROM public.feed_posts('replies', NULL, NULL, NULL, :'pa')) = 1);
SELECT pg_temp.ok('05f quote carries the original', (SELECT bool_and(orig_audio_path IS NOT NULL AND orig_author_username IS NOT NULL)
  FROM public.feed_posts('author', NULL, NULL, :B) WHERE repost_of IS NOT NULL));
SELECT pg_temp.ok('05g trending topic', (SELECT recent_posts FROM public.trending_topics('tech') WHERE id = :'t1') = 1);
SELECT pg_temp.ok('05h bad scope', pg_temp.fails($$SELECT public.feed_posts('everything')$$));
RESET ROLE;

-- 06 visibility: blocks, hidden, disabled
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.create_post('news', NULL, NULL, NULL, 'Dora news', '00000000-0000-0000-0000-00000000000d/d1.m4a', 'audio/mp4', 3000) AS pd \gset
SELECT public.follow_user(:A);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.block_user(:D);
SELECT pg_temp.ok('06a blocked author''s posts hidden', NOT EXISTS (SELECT 1 FROM public.feed_posts('all') WHERE author_id = :D)
  AND NOT EXISTS (SELECT 1 FROM public.posts WHERE author_id = :D));
SELECT pg_temp.ok('06b block removes follows', NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = :D));
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('06c blocked user cannot see / like / reply / follow',
  NOT EXISTS (SELECT 1 FROM public.posts WHERE author_id = :A)
  AND pg_temp.fails(format('SELECT public.like_post(%L)', :'pa'))
  AND pg_temp.fails(format($$SELECT public.create_post(NULL, NULL, %L, NULL, NULL, '00000000-0000-0000-0000-00000000000d/d1.m4a', 'audio/mp4', 2000)$$, :'pa'))
  AND pg_temp.fails($$SELECT public.follow_user('00000000-0000-0000-0000-00000000000a')$$));
RESET ROLE;
UPDATE public.posts SET hidden = true WHERE id = :'pc';
UPDATE public.profiles SET disabled = true WHERE id = :B;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('06d hidden post and disabled author gone', NOT EXISTS (SELECT 1 FROM public.feed_posts('all') WHERE post_id = :'pc' OR author_id = :B));
RESET ROLE;
UPDATE public.profiles SET disabled = false WHERE id = :B;

-- 07 admin topics
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.admin_update_topic(:'t1', true);
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('07a hidden topic invisible', NOT EXISTS (SELECT 1 FROM public.topics WHERE id = :'t1'));
SELECT pg_temp.ok('07b cannot post into hidden topic', pg_temp.fails(format($$SELECT public.create_post(NULL, %L, NULL, NULL, NULL, '00000000-0000-0000-0000-00000000000a/a2.m4a', 'audio/mp4', 2000)$$, :'t1')));
SELECT pg_temp.ok('07c am_i_admin', NOT public.am_i_admin());
SELECT pg_temp.ok('07d non-admin cannot hide topics', pg_temp.fails(format('SELECT public.admin_update_topic(%L, false)', :'t1')));
RESET ROLE;

-- 08 reports on posts, storage
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('08a report a post', NOT pg_temp.fails(format($$SELECT public.report_content('post', %L, 'spam')$$, :'pa')));
SELECT pg_temp.ok('08b upload only into own folder', pg_temp.fails($$INSERT INTO storage.objects (bucket_id, name) VALUES ('voices', '00000000-0000-0000-0000-00000000000a/x.m4a')$$)
  AND NOT pg_temp.fails($$INSERT INTO storage.objects (bucket_id, name) VALUES ('voices', '00000000-0000-0000-0000-00000000000c/x.m4a')$$));
SELECT pg_temp.ok('08c delete own post (replies cascade)', NOT pg_temp.fails(format('DELETE FROM public.posts WHERE id = %L', :'pc')));
RESET ROLE;
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
DELETE FROM public.posts WHERE id = :'pa';
RESET ROLE;
SELECT pg_temp.ok('08d deleting a post removes its replies and reposts', NOT EXISTS (SELECT 1 FROM public.posts WHERE reply_to = :'pa' OR repost_of = :'pa'));
