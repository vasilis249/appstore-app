\set ON_ERROR_STOP 0
-- P1 player, P2 player (private), P3 player, O1 owner, AD admin
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'p1@s', '{"full_name":"P One"}'),
  ('00000000-0000-0000-0000-0000000005a2', 'p2@s', '{"full_name":"P Two"}'),
  ('00000000-0000-0000-0000-0000000005a3', 'p3@s', '{"full_name":"P Three"}'),
  ('00000000-0000-0000-0000-0000000005b1', 'o1@s', '{"full_name":"Owner","role":"owner"}'),
  ('00000000-0000-0000-0000-0000000005c1', 'ad@s', '{"full_name":"Admin","role":"admin"}');
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000005c1', 'admin');
UPDATE public.profiles SET is_private = true WHERE user_id = '00000000-0000-0000-0000-0000000005a2';
INSERT INTO public.follows (follower_id, following_id, status) VALUES ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005a2', 'accepted');
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005b1');
CREATE OR REPLACE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE OR REPLACE FUNCTION pg_temp.as_system() RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', '', false); PERFORM set_config('request.jwt.claims', '', false); END $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN cond THEN 'PASS' ELSE 'FAIL' END, label; END $$;

SELECT pg_temp.ok('00 signup cannot self-assign admin', NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000005c1' AND role = 'admin' AND id IN (
    SELECT id FROM public.user_roles WHERE created_at = (SELECT min(created_at) FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000005c1'))));

-- 01 probes by P1 about other people return false
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a1'); SET ROLE authenticated;
SELECT pg_temp.ok('01a can_view_profile(other viewer) hidden', NOT public.can_view_profile('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005a2'));
SELECT pg_temp.ok('01b is_blocked_between(third parties) hidden', NOT public.is_blocked_between('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005b1'));
SELECT pg_temp.ok('01c has_role(other) hidden', NOT public.has_role('00000000-0000-0000-0000-0000000005c1', 'admin'));
SELECT pg_temp.ok('01d own checks still work', public.can_view_profile(auth.uid(), '00000000-0000-0000-0000-0000000005a3')
  AND NOT public.can_view_profile(auth.uid(), '00000000-0000-0000-0000-0000000005a2'));
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
SELECT pg_temp.ok('01e follower still sees private profile', public.can_view_profile(auth.uid(), '00000000-0000-0000-0000-0000000005a2'));
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005c1'); SET ROLE authenticated;
SELECT pg_temp.ok('01f admin checks own role', public.has_role(auth.uid(), 'admin'));
RESET ROLE;

-- 02 venues: player cannot create; owner creates but cannot self-approve or fake rating
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a1'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.venues (name, sport, area, address, base_price_per_hour, courts_count, owner_id, approved)
  VALUES ('Fake', 'padel', 'X', 'Y', 10, 1, auth.uid(), true);
  RAISE NOTICE 'FAIL 02a player created venue';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 02a player cannot create venue';
END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005b1'); SET ROLE authenticated;
INSERT INTO public.venues (id, name, sport, area, address, base_price_per_hour, courts_count, owner_id, approved, rating, reviews_count)
VALUES ('00000000-0000-0000-0000-00000000fe01', 'Owner Arena', 'padel', 'X', 'Y', 10, 1, auth.uid(), true, 5, 999);
UPDATE public.venues SET approved = true, rating = 5, owner_id = '00000000-0000-0000-0000-0000000005a1', name = 'Owner Arena 2' WHERE id = '00000000-0000-0000-0000-00000000fe01';
RESET ROLE;
SELECT pg_temp.ok('02b owner venue not self-approved, rating/owner frozen, name edited',
  (SELECT NOT approved AND rating = 0 AND reviews_count = 0 AND owner_id = '00000000-0000-0000-0000-0000000005b1' AND name = 'Owner Arena 2'
   FROM public.venues WHERE id = '00000000-0000-0000-0000-00000000fe01'));
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005c1'); SET ROLE authenticated;
UPDATE public.venues SET approved = true WHERE id = '00000000-0000-0000-0000-00000000fe01';
RESET ROLE;
SELECT pg_temp.ok('02c admin approves', (SELECT approved FROM public.venues WHERE id = '00000000-0000-0000-0000-00000000fe01'));

-- setup: court + past booking by P1 with open game; future booking with open game
SELECT pg_temp.as_system();
INSERT INTO public.courts (id, venue_id, name, sport) VALUES ('00000000-0000-0000-0000-00000000ce01', '00000000-0000-0000-0000-00000000fe01', 'C1', 'padel');
ALTER TABLE public.bookings DISABLE TRIGGER USER;
INSERT INTO public.bookings (id, court_id, venue_id, player_id, date, start_time, duration_hours, type, status, price) VALUES
  ('00000000-0000-0000-0000-0000000bb001', '00000000-0000-0000-0000-00000000ce01', '00000000-0000-0000-0000-00000000fe01', '00000000-0000-0000-0000-0000000005a1', current_date - 1, '10:00', 1, 'online', 'confirmed', 20),
  ('00000000-0000-0000-0000-0000000bb002', '00000000-0000-0000-0000-00000000ce01', '00000000-0000-0000-0000-00000000fe01', '00000000-0000-0000-0000-0000000005a1', current_date + 5, '10:00', 1, 'online', 'confirmed', 20);
ALTER TABLE public.bookings ENABLE TRIGGER USER;
INSERT INTO public.open_games (id, venue_id, sport, date, start_time, max_players, host_id, booking_id) VALUES
  ('00000000-0000-0000-0000-0000000a9001', '00000000-0000-0000-0000-00000000fe01', 'padel', current_date - 1, '10:00', 4, '00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000bb001');
INSERT INTO public.open_game_players (open_game_id, player_id) VALUES ('00000000-0000-0000-0000-0000000a9001', '00000000-0000-0000-0000-0000000005a2');

-- 03 open games
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.open_game_players (open_game_id, player_id) VALUES ('00000000-0000-0000-0000-0000000a9001', auth.uid());
  RAISE NOTICE 'FAIL 03a direct join allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03a direct join blocked';
END $$;
SELECT pg_temp.ok('03b cannot join a finished game', public.join_open_game('00000000-0000-0000-0000-0000000a9001')->>'error' = 'started');
DO $$ BEGIN
  INSERT INTO public.open_games (venue_id, sport, date, start_time, max_players, host_id)
  VALUES ('00000000-0000-0000-0000-00000000fe01', 'padel', current_date + 1, '18:00', 4, auth.uid());
  RAISE NOTICE 'FAIL 03c fake open game allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03c fake open game blocked';
END $$;
DO $$ BEGIN
  INSERT INTO public.open_games (venue_id, sport, date, start_time, max_players, host_id, booking_id)
  VALUES ('00000000-0000-0000-0000-00000000fe01', 'padel', current_date + 5, '10:00', 4, auth.uid(), '00000000-0000-0000-0000-0000000bb002');
  RAISE NOTICE 'FAIL 03d open game on someone else''s booking allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 03d open game on someone else''s booking blocked';
END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a1'); SET ROLE authenticated;
INSERT INTO public.open_games (id, venue_id, sport, date, start_time, max_players, host_id, booking_id)
VALUES ('00000000-0000-0000-0000-0000000a9002', '00000000-0000-0000-0000-00000000fe01', 'padel', current_date + 5, '10:00', 4, auth.uid(), '00000000-0000-0000-0000-0000000bb002');
UPDATE public.open_games SET date = current_date + 9, notes = 'Φέρτε μπάλες' WHERE id = '00000000-0000-0000-0000-0000000a9002';
RESET ROLE;
SELECT pg_temp.ok('03e host game on own booking; date frozen, notes edited',
  (SELECT date = current_date + 5 AND notes = 'Φέρτε μπάλες' FROM public.open_games WHERE id = '00000000-0000-0000-0000-0000000a9002'));
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
SELECT pg_temp.ok('03f join future game via RPC', (public.join_open_game('00000000-0000-0000-0000-0000000a9002')->>'ok')::boolean);
RESET ROLE;

-- 04 reviews
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.reviews (reviewer_id, target_player_id, rating) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000005a1', 1);
  RAISE NOTICE 'FAIL 04a review without game allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 04a review without shared game blocked';
END $$;
DO $$ BEGIN
  INSERT INTO public.reviews (reviewer_id, target_player_id, rating, open_game_id) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000005a1', 1, '00000000-0000-0000-0000-0000000a9002');
  RAISE NOTICE 'FAIL 04b review of future game allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 04b review before the game ends blocked';
END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a2'); SET ROLE authenticated;
INSERT INTO public.reviews (reviewer_id, target_player_id, rating, open_game_id) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000005a1', 5, '00000000-0000-0000-0000-0000000a9001');
DO $$ BEGIN
  INSERT INTO public.reviews (reviewer_id, target_player_id, rating, open_game_id) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000005a1', 5, '00000000-0000-0000-0000-0000000a9001');
  RAISE NOTICE 'FAIL 04c duplicate review allowed';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 04c one review per game';
END $$;
UPDATE public.reviews SET target_player_id = '00000000-0000-0000-0000-0000000005a3', rating = 4 WHERE reviewer_id = auth.uid();
RESET ROLE;
SELECT pg_temp.ok('04d teammates can review; only rating changes',
  (SELECT count(*) = 1 AND bool_and(rating = 4 AND target_player_id = '00000000-0000-0000-0000-0000000005a1') FROM public.reviews));

-- 05 notifications: only read_at is writable
SELECT pg_temp.as_system();
INSERT INTO public.notifications (user_id, type, title, body) VALUES ('00000000-0000-0000-0000-0000000005a1', 'test', 'T', 'B');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a1'); SET ROLE authenticated;
DO $$ BEGIN
  UPDATE public.notifications SET body = 'hacked' WHERE user_id = auth.uid();
  RAISE NOTICE 'FAIL 05a body editable';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 05a body not editable';
END $$;
UPDATE public.notifications SET read_at = now() WHERE user_id = auth.uid();
DO $$ BEGIN
  INSERT INTO public.notifications (user_id, type, title) VALUES ('00000000-0000-0000-0000-0000000005a2', 'x', 'spoof');
  RAISE NOTICE 'FAIL 05b spoofed notification';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 05b cannot create notifications';
END $$;
RESET ROLE;
SELECT pg_temp.ok('05c read_at set', (SELECT read_at IS NOT NULL FROM public.notifications WHERE type = 'test'));

-- 06 like/unlike loop creates one notification; comment rate limit
SELECT pg_temp.as_system();
INSERT INTO public.posts (id, author_id, caption, media) VALUES ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000005a1', 'hi', ARRAY['00000000-0000-0000-0000-0000000005a1/x.jpg']);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
DO $$ BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO public.post_likes (post_id, user_id) VALUES ('00000000-0000-0000-0000-0000000d0001', auth.uid());
    DELETE FROM public.post_likes WHERE post_id = '00000000-0000-0000-0000-0000000d0001' AND user_id = auth.uid();
  END LOOP;
END $$;
DO $$ BEGIN
  FOR i IN 1..20 LOOP
    INSERT INTO public.post_comments (post_id, author_id, body) VALUES ('00000000-0000-0000-0000-0000000d0001', auth.uid(), 'c' || i);
  END LOOP;
  RAISE NOTICE 'FAIL 06b no comment rate limit';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 06b comments rate limited';
END $$;
RESET ROLE;
SELECT pg_temp.ok('06a like loop -> 1 notification', (SELECT count(*) = 1 FROM public.notifications WHERE type = 'post_like'));

-- 07 public buckets are not listable
SELECT pg_temp.ok('07 no listing policies on public buckets', NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND cmd = 'SELECT' AND qual ~ '(avatars|venue-photos)'));

-- 08 private helpers are not reachable
SELECT pg_temp.ok('08 private schema not usable by clients', NOT has_schema_privilege('authenticated', 'private', 'USAGE') AND NOT has_schema_privilege('anon', 'private', 'USAGE'));

-- 09 booking RPC called directly: arbitrary time/duration, unapproved venue, closures, far future
SELECT pg_temp.as_system();
INSERT INTO public.court_slots (court_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-00000000ce01', d, '18:00', '19:30' FROM generate_series(0, 6) d;
INSERT INTO public.court_closures (court_id, date, start_time, end_time, reason)
VALUES ('00000000-0000-0000-0000-00000000ce01', current_date + 3, '17:00', '20:00', 'maintenance');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a3'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM public.create_whole_booking('00000000-0000-0000-0000-00000000fe01', current_date + 2, '06:00', 16, '00000000-0000-0000-0000-00000000ce01');
  RAISE NOTICE 'FAIL 09a whole-day lock allowed';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 09a arbitrary time/duration rejected';
END $$;
DO $$ BEGIN
  PERFORM public.create_whole_booking('00000000-0000-0000-0000-00000000fe01', current_date + 3, '18:00', 1.5, '00000000-0000-0000-0000-00000000ce01');
  RAISE NOTICE 'FAIL 09b booking during closure allowed';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 09b closure respected';
END $$;
DO $$ BEGIN
  PERFORM public.create_whole_booking('00000000-0000-0000-0000-00000000fe01', current_date + 400, '18:00', 1.5, '00000000-0000-0000-0000-00000000ce01');
  RAISE NOTICE 'FAIL 09c far-future booking allowed';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 09c far-future rejected';
END $$;
DO $$ DECLARE r jsonb; BEGIN
  r := public.create_slot_booking('00000000-0000-0000-0000-00000000fe01', current_date + 2, '18:00', 1.5, 99, '00000000-0000-0000-0000-00000000ce01');
  RAISE NOTICE 'FAIL 09d open game of 99 players allowed: %', r;
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 09d max players capped';
END $$;
SELECT pg_temp.ok('09e valid slot booking works',
  (public.create_slot_booking('00000000-0000-0000-0000-00000000fe01', current_date + 2, '18:00', 1.5, 4, '00000000-0000-0000-0000-00000000ce01')->>'ok')::boolean);
RESET ROLE;
SELECT pg_temp.as_system();
UPDATE public.venues SET approved = false WHERE id = '00000000-0000-0000-0000-00000000fe01';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000005a2'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM public.create_whole_booking('00000000-0000-0000-0000-00000000fe01', current_date + 4, '18:00', 1.5, '00000000-0000-0000-0000-00000000ce01');
  RAISE NOTICE 'FAIL 09f unapproved venue bookable';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 09f unapproved venue not bookable';
END $$;
RESET ROLE;
