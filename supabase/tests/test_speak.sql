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
SELECT pg_temp.ok('05g2 one post (replies included)', (SELECT count(*) FROM public.feed_posts('one', NULL, NULL, NULL, :'rb')) = 1);
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
SELECT pg_temp.ok('07a2 posts drop the hidden topic''s title', NOT EXISTS (SELECT 1 FROM public.feed_posts('all') WHERE topic_id = :'t1' AND topic_title IS NOT NULL));
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

-- 09 notifications (follow / like / reply / repost), lists, suggestions
DELETE FROM public.notifications;
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.follow_user(:A);
RESET ROLE;
INSERT INTO storage.objects (bucket_id, name) VALUES ('voices', '00000000-0000-0000-0000-00000000000a/n1.m4a'), ('voices', '00000000-0000-0000-0000-00000000000c/n2.m4a');
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.create_post('tech', NULL, NULL, NULL, 'Anna tech', '00000000-0000-0000-0000-00000000000a/n1.m4a', 'audio/mp4', 3000) AS pn \gset
SELECT public.like_post(:'pn');
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.like_post(:'pn'); SELECT public.unlike_post(:'pn'); SELECT public.like_post(:'pn');
SELECT public.create_post(NULL, NULL, :'pn', NULL, NULL, '00000000-0000-0000-0000-00000000000c/n2.m4a', 'audio/mp4', 2000);
SELECT public.create_post(NULL, NULL, NULL, :'pn');
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('09a follow, like (once), reply, repost notified; own like not',
  (SELECT array_agg(kind ORDER BY kind) FROM public.notifications WHERE actor_id = :C) = ARRAY['follow', 'like', 'reply', 'repost']
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE actor_id = :A));
SELECT pg_temp.ok('09b notifications point at the post', (SELECT bool_and(post_id = :'pn') FROM public.notifications WHERE kind <> 'follow'));
SELECT pg_temp.ok('09c followers list', EXISTS (SELECT 1 FROM public.follow_list(:A::uuid, 'followers') WHERE id = :C AND follows_me));
SELECT pg_temp.ok('09d following list', (SELECT count(*) FROM public.follow_list(:A::uuid, 'following')) = 1);
SELECT pg_temp.ok('09e suggestions exclude people I follow and me',
  NOT EXISTS (SELECT 1 FROM public.suggested_people(30) WHERE id IN (:A, :B)));
RESET ROLE;

-- 10 news ingestion (parsing only; fetching needs pg_net on the hosted project)
SELECT pg_temp.ok('10a clean_text strips tags and entities', private.clean_text('<b>A &amp; B</b>&nbsp; &quot;x&quot;') = 'A & B "x"');
SELECT format($x$<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Feed</title>
<item><title><![CDATA[Πρώτο νέο & <i>έντονο</i>]]></title><link>https://example.com/1</link><guid>g-1</guid><pubDate>%1$s</pubDate></item>
<item><title>Δεύτερο νέο &amp; κάτι</title><link>https://example.com/2</link><pubDate>%1$s</pubDate></item>
<item><title>Παλιό νέο</title><link>https://example.com/old</link><pubDate>Mon, 01 Jan 2024 10:00:00 +0000</pubDate></item>
<item><title>Τρίτο νέο</title><link>https://example.com/3</link><pubDate>%1$s</pubDate></item>
<item><title>Χωρίς link</title></item>
</channel></rss>$x$, to_char(now() AT TIME ZONE 'UTC', 'Dy, DD Mon YYYY HH24:MI:SS') || ' +0000') AS rss \gset
SELECT pg_temp.ok('10b at most 2 per run', private.ingest_feed_xml(3, :'rss', 2) = 2);
SELECT pg_temp.ok('10c titles cleaned, source + section from the feed',
  (SELECT count(*) FROM public.topics WHERE kind = 'news' AND section_id = 'tech' AND source_name = 'Techblog'
   AND title IN ('Πρώτο νέο & έντονο', 'Δεύτερο νέο & κάτι')) = 2);
SELECT pg_temp.ok('10d next run adds the rest, skips old / duplicates / no link', private.ingest_feed_xml(3, :'rss', 5) = 1
  AND private.ingest_feed_xml(3, :'rss', 5) = 0);
SELECT pg_temp.ok('10e broken XML raises (caught per feed by ingest_news)', pg_temp.fails($$SELECT private.ingest_feed_xml(3, '<rss><channel><item>', 2)$$));

-- 11 daily topic + admin tools
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('11a today() falls back to a fresh topic', (SELECT topic_id IS NOT NULL AND NOT topic_is_pick FROM public.today()));
SELECT pg_temp.ok('11b non-admin cannot list admin data', pg_temp.fails($$SELECT * FROM public.admin_topics()$$)
  AND pg_temp.fails($$SELECT * FROM public.admin_feeds()$$) AND pg_temp.fails($$SELECT public.admin_set_feed(1, false)$$)
  AND pg_temp.fails($$SELECT public.admin_refresh_news()$$));
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.admin_create_topic('humor', 'Ποιο είναι το χειρότερο αστείο που ξέρεις;', NULL, NULL, NULL, (SELECT moment FROM public.today())) AS dt \gset
SELECT pg_temp.ok('11c admin daily topic wins', (SELECT topic_id = :'dt' AND topic_is_pick FROM public.today()));
SELECT pg_temp.ok('11d one daily topic per day', pg_temp.fails($$SELECT public.admin_create_topic('news', 'Δεύτερο της ημέρας', NULL, NULL, NULL, (SELECT moment FROM public.today()))$$));
SELECT pg_temp.ok('11e admin lists topics and feeds', (SELECT count(*) FROM public.admin_topics()) >= 4 AND (SELECT count(*) FROM public.admin_feeds()) = 8);
SELECT public.admin_set_feed(1, false);
SELECT pg_temp.ok('11f admin toggles a feed', NOT (SELECT enabled FROM public.admin_feeds() WHERE id = 1));
RESET ROLE;

-- 12 ranking, threads, replies on profiles
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('voices', '00000000-0000-0000-0000-00000000000c/r0.m4a'), ('voices', '00000000-0000-0000-0000-00000000000c/old.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000c/new.m4a'), ('voices', '00000000-0000-0000-0000-00000000000b/r1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000c/r2.m4a');
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.create_post('tech', NULL, NULL, NULL, 'Old but loved', '00000000-0000-0000-0000-00000000000c/old.m4a', 'audio/mp4', 3000) AS pold \gset
SELECT public.create_post('tech', NULL, NULL, NULL, 'Brand new', '00000000-0000-0000-0000-00000000000c/new.m4a', 'audio/mp4', 3000) AS pnew \gset
SELECT public.create_post('news', NULL, NULL, NULL, 'Thread root', '00000000-0000-0000-0000-00000000000c/r0.m4a', 'audio/mp4', 3000) AS r0 \gset
RESET ROLE;
UPDATE public.posts SET created_at = now() - interval '10 hours', likes_count = 40 WHERE id = :'pold';
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.create_post(NULL, NULL, :'r0', NULL, NULL, '00000000-0000-0000-0000-00000000000b/r1.m4a', 'audio/mp4', 2000) AS r1 \gset
SELECT public.create_post(NULL, NULL, NULL, :'pnew') AS rpn \gset
RESET ROLE; SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.create_post(NULL, NULL, :'r1', NULL, NULL, '00000000-0000-0000-0000-00000000000c/r2.m4a', 'audio/mp4', 2000) AS r2 \gset
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('12a for you: engagement beats recency',
  (SELECT min(n) FILTER (WHERE post_id = :'pold') < min(n) FILTER (WHERE post_id = :'pnew')
   FROM public.feed_posts('foryou', p_limit := 50) WITH ORDINALITY AS f(post_id, created_at, author_id, author_username, author_name,
     author_avatar, section_id, topic_id, topic_title, reply_to, repost_of, title, audio_path, duration_ms, likes_count, replies_count,
     reposts_count, listens_count, liked, reposted, is_mine, orig_author_username, orig_author_name, orig_author_avatar, orig_title,
     orig_audio_path, orig_duration_ms, orig_created_at, orig_author_id, orig_likes_count, orig_replies_count, orig_reposts_count,
     orig_listens_count, reply_to_username, group_id, group_name, n)));
SELECT pg_temp.ok('12b for you: no plain reposts, no replies',
  NOT EXISTS (SELECT 1 FROM public.feed_posts('foryou', p_limit := 50) WHERE audio_path IS NULL OR reply_to IS NOT NULL));
SELECT pg_temp.ok('12c for you pages with offset', (SELECT count(*) FROM public.feed_posts('foryou', p_limit := 1, p_offset := 1)) = 1
  AND (SELECT post_id FROM public.feed_posts('foryou', p_limit := 1, p_offset := 0)) <> (SELECT post_id FROM public.feed_posts('foryou', p_limit := 1, p_offset := 1)));
SELECT pg_temp.ok('12d ancestors root first', public.post_ancestors(:'r2') = ARRAY[:'r0'::uuid, :'r1'::uuid]);
SELECT pg_temp.ok('12e ids scope keeps the order',
  (SELECT array_agg(post_id) FROM public.feed_posts('ids', p_ids := ARRAY[:'r1'::uuid, :'r0'::uuid])) = ARRAY[:'r1'::uuid, :'r0'::uuid]);
SELECT pg_temp.ok('12f replying to @username', (SELECT reply_to_username FROM public.feed_posts('one', p_parent := :'r2')) = (SELECT username FROM public.profiles WHERE id = :B));
SELECT pg_temp.ok('12g replies tab on a profile', (SELECT array_agg(post_id) FROM public.feed_posts('author_replies', p_author := :B)) = ARRAY[:'r1'::uuid]);
SELECT pg_temp.ok('12h root has no ancestors', public.post_ancestors(:'r0') = ARRAY[]::uuid[]);
RESET ROLE;

-- 13 moderation: admin notification, auto-hide, review queue, actions, undo
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.report_content('post', :'pnew', 'spam');
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.report_content('post', :'pnew', 'hate');
RESET ROLE;
SELECT pg_temp.ok('13a one "reports to review" notification per admin', (SELECT count(*) FROM public.notifications WHERE kind = 'report' AND user_id = :E) = 1
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'report' AND user_id <> :E));
SELECT pg_temp.ok('13b two reports do not hide a post', NOT (SELECT hidden FROM public.posts WHERE id = :'pnew'));
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.report_content('post', :'pnew', 'spam');
RESET ROLE;
SELECT pg_temp.ok('13c three different reporters hide it', (SELECT hidden FROM public.posts WHERE id = :'pnew'));
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.report_content('user', :C, 'spam');
RESET ROLE;
SELECT pg_temp.ok('13c2 an admin who reports keeps their notification', (SELECT count(*) FROM public.notifications WHERE kind = 'report' AND user_id = :E) = 1);
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('13d non-admins cannot moderate', pg_temp.fails($$SELECT public.admin_reports()$$)
  AND pg_temp.fails(format($$SELECT public.admin_set_post_hidden(%L, false)$$, :'pnew'))
  AND pg_temp.fails(format($$SELECT public.admin_set_user_disabled(%L, true)$$, :B))
  AND pg_temp.fails($$SELECT public.admin_open_reports()$$)
  AND pg_temp.fails(format($$SELECT public.admin_resolve_report(id, 'dismiss') FROM public.reports LIMIT 1$$)));
SELECT public.report_content('user', :B, 'harassment');
SELECT public.report_content('user', :E, 'spam');
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('13e queue: counts per target, deleted posts flagged',
  (SELECT reports_on_target FROM public.admin_reports() WHERE target_id = :'pnew' LIMIT 1) = 3
  AND (SELECT NOT post_exists FROM public.admin_reports() WHERE target_id = :'pa')
  AND public.admin_open_reports() = 7);
SELECT public.admin_resolve_report(id, 'hide_post') AS closed FROM public.admin_reports() WHERE target_id = :'pnew' LIMIT 1 \gset
SELECT pg_temp.ok('13f hide_post closes every report on the post', :closed = 3
  AND public.admin_open_reports() = 4
  AND (SELECT count(*) FROM public.admin_reports(false) WHERE action = 'hide_post') = 3);
SELECT public.admin_set_post_hidden(:'pnew', false);
SELECT pg_temp.ok('13g undo: the post is back', EXISTS (SELECT 1 FROM public.feed_posts('one', p_parent := :'pnew')));
SELECT pg_temp.ok('13h hide_post only for post reports',
  pg_temp.fails(format($$SELECT public.admin_resolve_report(id, 'hide_post') FROM public.admin_reports() WHERE kind = 'user' AND target_user_id = %L$$, :B)));
SELECT pg_temp.ok('13i admins cannot be disabled',
  pg_temp.fails(format($$SELECT public.admin_resolve_report(id, 'disable_user') FROM public.admin_reports() WHERE target_user_id = %L$$, :E)));
SELECT public.admin_resolve_report(id, 'disable_user') FROM public.admin_reports() WHERE target_user_id = :B;
RESET ROLE;
SELECT pg_temp.ok('13j disable_user bans the account', (SELECT disabled FROM public.profiles WHERE id = :B));
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('13k a disabled account cannot use the app', pg_temp.fails($$SELECT public.feed_posts('all')$$));
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.admin_set_user_disabled(:B, false);
SELECT public.admin_resolve_report(id, 'dismiss') FROM public.admin_reports();
RESET ROLE;
SELECT pg_temp.ok('13l empty queue clears the admin notification; undo re-enables',
  NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'report')
  AND NOT EXISTS (SELECT 1 FROM public.reports WHERE resolved_at IS NULL)
  AND NOT (SELECT disabled FROM public.profiles WHERE id = :B));
