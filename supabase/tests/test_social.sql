\set ON_ERROR_STOP 0
-- Users: A (public), B (private), C (public, will be blocked by A)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'a@test', '{"full_name":"Βασίλης Χαρίτος"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test', '{"full_name":"Βασίλης Χαρίτος"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test', '{}');
CREATE OR REPLACE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN cond THEN 'PASS' ELSE 'FAIL' END, label; END $$;

SELECT pg_temp.ok('01 usernames: ' || string_agg(username, ', ' ORDER BY user_id),
  count(*) = 3 AND count(DISTINCT username) = 3 AND bool_and(username ~ '^[a-z0-9._]{3,30}$')
  AND min(username) FILTER (WHERE user_id::text LIKE '%a1') = 'vasilis.charitos')
FROM public.profiles;
UPDATE public.profiles SET is_private = true WHERE user_id = '00000000-0000-0000-0000-0000000000b1';

-- 02 profile guard
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
UPDATE public.profiles SET rating = 5, games_played = 999, bio = 'Padel lover' WHERE user_id = auth.uid();
RESET ROLE;
SELECT pg_temp.ok('02 rating/games frozen, bio saved', rating IS DISTINCT FROM 5 AND games_played = 0 AND bio = 'Padel lover')
FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-0000000000a1';

-- 03 follow public (accepted) and private (pending); direct insert denied
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
SELECT pg_temp.ok('03a follow private -> pending', public.follow_user('00000000-0000-0000-0000-0000000000b1') = 'pending');
DO $$ BEGIN
  INSERT INTO public.follows (follower_id, following_id) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000000c1');
  RAISE NOTICE 'FAIL 03b direct follow insert allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03b direct follow insert blocked';
END $$;
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
SELECT pg_temp.ok('03c follow public -> accepted', public.follow_user('00000000-0000-0000-0000-0000000000a1') = 'accepted');

-- 04 private posts hidden until accepted
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
INSERT INTO public.posts (author_id, caption, media) VALUES (auth.uid(), 'B private post', ARRAY['00000000-0000-0000-0000-0000000000b1/p1/1.jpg']);
DO $$ BEGIN
  INSERT INTO public.posts (author_id, caption, media) VALUES (auth.uid(), 'steal', ARRAY['00000000-0000-0000-0000-0000000000a1/x.jpg']);
  RAISE NOTICE 'FAIL 04a foreign media path allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 04a foreign media path blocked';
END $$;
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
SELECT pg_temp.ok('04b pending follower cannot see private post', (SELECT count(*) FROM public.posts WHERE caption = 'B private post') = 0);
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
SELECT public.accept_follow_request('00000000-0000-0000-0000-0000000000a1');
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
SELECT pg_temp.ok('04c accepted follower sees private post', (SELECT count(*) FROM public.posts WHERE caption = 'B private post') = 1);
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
SELECT pg_temp.ok('04d stranger cannot see private post', (SELECT count(*) FROM public.posts WHERE caption = 'B private post') = 0);

-- 05 likes and counters; client cannot fake counters, can edit caption
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
INSERT INTO public.post_likes (post_id, user_id) SELECT id, auth.uid() FROM public.posts WHERE caption = 'B private post';
INSERT INTO public.post_comments (post_id, author_id, body) SELECT id, auth.uid(), 'Ωραίο!' FROM public.posts WHERE caption = 'B private post';
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
UPDATE public.posts SET like_count = 1000, caption = 'B edited' WHERE author_id = auth.uid();
RESET ROLE;
SELECT pg_temp.ok('05 counters 1/1, caption edited, fake counter ignored', like_count = 1 AND comment_count = 1 AND caption = 'B edited')
FROM public.posts WHERE author_id = '00000000-0000-0000-0000-0000000000b1';
SELECT pg_temp.ok('05b notifications for B: ' || string_agg(type, ','), count(*) >= 3)
FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-0000000000b1';

-- 06 blocking: A blocks C → follows removed, C can't see A's posts or comment
INSERT INTO public.posts (author_id, caption, media) VALUES ('00000000-0000-0000-0000-0000000000a1', 'A public post', ARRAY['00000000-0000-0000-0000-0000000000a1/p/1.jpg']);
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.ok('06a block removed follows', NOT EXISTS (SELECT 1 FROM public.follows WHERE '00000000-0000-0000-0000-0000000000c1' IN (follower_id, following_id)));
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
SELECT pg_temp.ok('06b blocked user cannot see posts', (SELECT count(*) FROM public.posts WHERE caption = 'A public post') = 0);
DO $$ BEGIN
  PERFORM public.follow_user('00000000-0000-0000-0000-0000000000a1');
  RAISE NOTICE 'FAIL 06c blocked user could follow';
EXCEPTION WHEN others THEN RAISE NOTICE 'PASS 06c blocked user cannot follow (%)', SQLERRM;
END $$;

-- 07 stories: expiry forced to 24h, expired hidden, views
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
INSERT INTO public.stories (author_id, media_path, expires_at) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000000a1/s/1.jpg', now() + interval '30 days');
RESET ROLE;
SELECT pg_temp.ok('07a expiry forced to 24h', expires_at < now() + interval '25 hours') FROM public.stories;
INSERT INTO public.stories (author_id, media_path) VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1/s/old.jpg');
ALTER TABLE public.stories DISABLE TRIGGER stories_set_expiry;
UPDATE public.stories SET expires_at = now() - interval '1 hour' WHERE media_path LIKE '%old.jpg';
ALTER TABLE public.stories ENABLE TRIGGER stories_set_expiry;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
SELECT pg_temp.ok('07b follower sees only active story', (SELECT count(*) FROM public.stories) = 1);
INSERT INTO public.story_views (story_id, viewer_id) SELECT id, auth.uid() FROM public.stories;
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
SELECT pg_temp.ok('07c author sees 1 view', (SELECT count(*) FROM public.story_views) = 1);
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
SELECT pg_temp.ok('07d blocked user sees no stories', (SELECT count(*) FROM public.stories) = 0);

-- 08 match stats: past booking counts, future/cancelled do not, joined game counts once
RESET ROLE; SELECT set_config('request.jwt.claims', '', false);
INSERT INTO public.venues (id, name, sport, area, address, lat, lng, base_price_per_hour, courts_count, approved)
VALUES ('00000000-0000-0000-0000-00000000f001', 'Test Padel', 'padel', 'Αθήνα', 'Οδός 1', 37.9, 23.7, 20, 1, true);
INSERT INTO public.courts (id, venue_id, name, sport) VALUES ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', 'Κορτ 1', 'padel');
ALTER TABLE public.bookings DISABLE TRIGGER USER;
INSERT INTO public.bookings (id, court_id, venue_id, player_id, date, start_time, duration_hours, type, status, price) VALUES
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', current_date - 3, '10:00', 1, 'online', 'confirmed', 20),
  ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', current_date - 2, '10:00', 1, 'online', 'cancelled', 20),
  ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', current_date + 2, '10:00', 1, 'online', 'confirmed', 20);
ALTER TABLE public.bookings ENABLE TRIGGER USER;
INSERT INTO public.open_games (id, venue_id, sport, date, start_time, max_players, host_id, booking_id)
VALUES ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000f001', 'padel', current_date - 3, '10:00', 4, '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000b0001');
INSERT INTO public.open_game_players (open_game_id, player_id) VALUES ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b1');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
SELECT pg_temp.ok('08a host A: 1 padel match', (SELECT sum(matches) FROM public.player_match_stats('00000000-0000-0000-0000-0000000000a1')) = 1);
SELECT pg_temp.ok('08b joiner B: 1 padel match', (SELECT sum(matches) FROM public.player_match_stats('00000000-0000-0000-0000-0000000000b1')) = 1);

-- 09 match post must reference own game
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.posts (author_id, kind, booking_id) VALUES (auth.uid(), 'match', '00000000-0000-0000-0000-0000000b0001');
  RAISE NOTICE 'FAIL 09 foreign match post allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 09 foreign match post blocked';
END $$;
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
INSERT INTO public.posts (author_id, kind, open_game_id, caption) VALUES (auth.uid(), 'match', '00000000-0000-0000-0000-00000000a001', 'Great game');
SELECT pg_temp.ok('09b own match post created', (SELECT count(*) FROM public.posts WHERE kind = 'match') = 1);

-- 10 reports visible only to reporter/admin; going public accepts pending
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); SET ROLE authenticated;
INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason) SELECT auth.uid(), 'profile', '00000000-0000-0000-0000-0000000000a1', 'spam';
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
SELECT pg_temp.ok('10a others cannot read reports', (SELECT count(*) FROM public.content_reports) = 0);
RESET ROLE;
UPDATE public.profiles SET is_private = true WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
SELECT pg_temp.ok('10b follow private A -> pending', public.follow_user('00000000-0000-0000-0000-0000000000a1') = 'pending');
RESET ROLE;
UPDATE public.profiles SET is_private = false WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.ok('10c going public accepted request', status = 'accepted') FROM public.follows
WHERE follower_id = '00000000-0000-0000-0000-0000000000b1' AND following_id = '00000000-0000-0000-0000-0000000000a1';
RESET ROLE;
