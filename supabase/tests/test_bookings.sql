-- Booking security checks. Each block prints PASS/FAIL.
\set ON_ERROR_STOP 0
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'player@test'),
  ('00000000-0000-0000-0000-00000000000b', 'owner@test'),
  ('00000000-0000-0000-0000-00000000000c', 'other@test');
-- Owner's own test venue (demo venues were removed by a migration).
INSERT INTO public.venues (id, owner_id, name, sport, area, address, base_price_per_hour, slot_price, courts_count, approved)
VALUES ('22222222-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000000b', 'Test Arena', 'padel', 'Test', 'Test 1', 20, 8, 1, true);
INSERT INTO public.courts (venue_id, name, sport) VALUES ('22222222-0000-0000-0000-0000000000aa', 'Court 1', 'padel');
INSERT INTO public.court_slots (court_id, day_of_week, start_time, end_time)
SELECT c.id, d, t::time, (t::time + interval '90 minutes')::time
FROM public.courts c, generate_series(0, 6) d, unnest(ARRAY['10:00', '18:00', '20:00']) t
WHERE c.venue_id = '22222222-0000-0000-0000-0000000000aa';
CREATE TEMP TABLE t AS
SELECT v.id AS venue, (SELECT c.id FROM public.courts c WHERE c.venue_id = v.id ORDER BY c.name LIMIT 1) AS court,
       (current_date + 3) AS d
FROM public.venues v WHERE owner_id = '00000000-0000-0000-0000-00000000000b';
GRANT SELECT ON t TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;

-- 1) player: direct INSERT must fail
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.bookings (court_id, venue_id, player_id, date, start_time, duration_hours, type, status, price)
  SELECT court, venue, auth.uid(), d, '10:00', 1, 'online', 'confirmed', 0 FROM t;
  RAISE NOTICE 'FAIL 1 direct insert allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 1 direct insert blocked';
END $$;

-- 2) player: RPC booking works
DO $$ DECLARE r jsonb; BEGIN
  SELECT public.create_whole_booking(venue, d, '10:00', 1.5, court) INTO r FROM t;
  RAISE NOTICE '% 2 rpc booking: %', CASE WHEN (r->>'ok')::bool THEN 'PASS' ELSE 'FAIL' END, r;
END $$;

-- 3) player: change price must fail
DO $$ BEGIN
  UPDATE public.bookings SET price = 0 WHERE player_id = auth.uid();
  RAISE NOTICE 'FAIL 3 price change allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 3 price change blocked';
END $$;

-- 4) player: DELETE must fail
DO $$ BEGIN
  DELETE FROM public.bookings WHERE player_id = auth.uid();
  RAISE NOTICE 'FAIL 4 delete allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 4 delete blocked';
END $$;

-- 5) other player: overlapping RPC booking on same court must fail
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  SELECT public.create_whole_booking(venue, d, '10:30', 1, court) INTO r FROM t;
  RAISE NOTICE '% 5 overlap: %', CASE WHEN (r->>'ok')::bool THEN 'FAIL' ELSE 'PASS' END, r;
END $$;

-- 6) other player: cannot cancel someone else's booking (RLS hides it -> 0 rows)
DO $$ DECLARE n int; BEGIN
  UPDATE public.bookings SET status = 'cancelled' WHERE date = (SELECT d FROM t);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '% 6 foreign cancel rows=%', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n;
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 6 foreign cancel blocked';
END $$;

-- 7) player: cancel own booking works (the app's cancelMyBooking update)
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  UPDATE public.bookings SET status = 'cancelled' WHERE player_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '% 7 own cancel rows=%', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n;
END $$;

-- 8) player: un-cancel must fail
DO $$ BEGIN
  UPDATE public.bookings SET status = 'confirmed' WHERE player_id = auth.uid();
  RAISE NOTICE 'FAIL 8 un-cancel allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 8 un-cancel blocked';
END $$;

-- 9) player: slot booking RPC (open game) works
DO $$ DECLARE r jsonb; BEGIN
  SELECT public.create_slot_booking(venue, d, '18:00', 1.5, 4, court) INTO r FROM t;
  RAISE NOTICE '% 9 slot rpc: %', CASE WHEN (r->>'ok')::bool THEN 'PASS' ELSE 'FAIL' END, r;
END $$;

-- 10) other player joins that open game
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  SELECT public.create_slot_booking(venue, d, '18:00', 1.5, 4, court) INTO r FROM t;
  RAISE NOTICE '% 10 join open game: %', CASE WHEN (r->>'joined')::bool THEN 'PASS' ELSE 'FAIL' END, r;
END $$;

-- 11) owner: direct phone booking + edit + delete still work
RESET ROLE; SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); SET ROLE authenticated;
DO $$ DECLARE bid uuid; BEGIN
  INSERT INTO public.bookings (court_id, venue_id, player_id, date, start_time, duration_hours, type, status, price, customer_name, customer_phone)
  SELECT court, venue, NULL, d, '12:00', 1, 'phone', 'confirmed', 20, 'Walk-in', '6900000000' FROM t RETURNING id INTO bid;
  UPDATE public.bookings SET price = 25 WHERE id = bid;
  DELETE FROM public.bookings WHERE id = bid;
  RAISE NOTICE 'PASS 11 owner insert/update/delete';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FAIL 11 owner: %', SQLERRM;
END $$;

-- 12) anon cannot call booking RPCs
RESET ROLE; SET ROLE anon;
DO $$ BEGIN
  PERFORM public.create_whole_booking(venue, d, '20:00', 1.5, court) FROM t;
  RAISE NOTICE 'FAIL 12 anon rpc allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 12 anon rpc blocked';
END $$;

-- 13) service_role (web server) can still edit price
RESET ROLE; SET ROLE service_role;
DO $$ DECLARE n int; BEGIN
  UPDATE public.bookings SET price = price + 1 WHERE date = (SELECT d FROM t) AND status <> 'cancelled';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '% 13 service_role update rows=%', CASE WHEN n >= 1 THEN 'PASS' ELSE 'FAIL' END, n;
END $$;
RESET ROLE;
