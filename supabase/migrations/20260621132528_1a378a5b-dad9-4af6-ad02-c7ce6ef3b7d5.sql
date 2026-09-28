
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tsrange(
      date + start_time,
      date + start_time + make_interval(mins => round(duration_hours * 60)::int)
    ) WITH &&
  )
  WHERE (status <> 'cancelled');

CREATE OR REPLACE FUNCTION public.create_whole_booking(_venue uuid, _date date, _start time without time zone, _duration numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid := auth.uid();
  _sport sport;
  _price numeric;
  _booking_id uuid;
  _free_court uuid;
  _end_time time;
  _slot_ts timestamp;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  _end_time := (_start::interval + (_duration || ' hours')::interval)::time;
  _slot_ts := (_date::timestamp + _start::interval);

  IF _slot_ts <= (now() AT TIME ZONE 'Europe/Athens') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'past_slot');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_venue::text || '|' || _date::text || '|' || _start::text, 0)
  );

  SELECT v.sport, v.base_price_per_hour INTO _sport, _price
  FROM venues v WHERE v.id = _venue;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.player_id = _user
      AND b.date = _date
      AND b.status <> 'cancelled'
      AND b.start_time < _end_time
      AND (b.start_time::interval + (b.duration_hours || ' hours')::interval)::time > _start
  ) OR EXISTS (
    SELECT 1 FROM open_game_players ogp
    JOIN open_games og ON og.id = ogp.open_game_id
    WHERE ogp.player_id = _user
      AND og.date = _date
      AND og.start_time < _end_time
      AND (og.start_time::interval + (_duration || ' hours')::interval)::time > _start
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_overlap');
  END IF;

  SELECT c.id INTO _free_court
  FROM courts c
  WHERE c.venue_id = _venue AND c.sport = _sport
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.court_id = c.id AND b.date = _date AND b.status <> 'cancelled'
        AND b.start_time < _end_time
        AND (b.start_time::interval + (b.duration_hours || ' hours')::interval)::time > _start
    )
  ORDER BY c.name LIMIT 1;

  IF _free_court IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_court');
  END IF;

  BEGIN
    INSERT INTO bookings (
      court_id, venue_id, player_id, date, start_time,
      duration_hours, type, status, price
    ) VALUES (
      _free_court, _venue, _user, _date, _start,
      _duration, 'online', 'confirmed', _price * _duration
    ) RETURNING id INTO _booking_id;
  EXCEPTION WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_court');
  END;

  RETURN jsonb_build_object('ok', true, 'booking_id', _booking_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_slot_booking(_venue uuid, _date date, _start time without time zone, _duration numeric, _max_players integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid := auth.uid();
  _sport sport;
  _slot_price numeric;
  _booking_id uuid;
  _open_game_id uuid;
  _free_court uuid;
  _existing_game_id uuid;
  _existing_booking_id uuid;
  _existing_max int;
  _player_count int;
  _end_time time;
  _slot_ts timestamp;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  _end_time := (_start::interval + (_duration || ' hours')::interval)::time;
  _slot_ts := (_date::timestamp + _start::interval);

  IF _slot_ts <= (now() AT TIME ZONE 'Europe/Athens') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'past_slot');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_venue::text || '|' || _date::text || '|' || _start::text, 0)
  );

  SELECT v.sport, v.slot_price INTO _sport, _slot_price
  FROM venues v WHERE v.id = _venue;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.player_id = _user
      AND b.date = _date
      AND b.status <> 'cancelled'
      AND b.start_time < _end_time
      AND (b.start_time::interval + (b.duration_hours || ' hours')::interval)::time > _start
  ) OR EXISTS (
    SELECT 1 FROM open_game_players ogp
    JOIN open_games og ON og.id = ogp.open_game_id
    WHERE ogp.player_id = _user
      AND og.date = _date
      AND og.start_time < _end_time
      AND (og.start_time::interval + (_duration || ' hours')::interval)::time > _start
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_overlap');
  END IF;

  SELECT og.id, og.booking_id, og.max_players
  INTO _existing_game_id, _existing_booking_id, _existing_max
  FROM open_games og
  WHERE og.venue_id = _venue AND og.date = _date AND og.start_time = _start
  LIMIT 1;

  IF _existing_game_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _player_count
    FROM open_game_players WHERE open_game_id = _existing_game_id;
    IF (1 + _player_count) >= _existing_max THEN
      RETURN jsonb_build_object('ok', false, 'error', 'slot_full');
    END IF;
    IF EXISTS (
      SELECT 1 FROM open_games WHERE id = _existing_game_id AND host_id = _user
    ) OR EXISTS (
      SELECT 1 FROM open_game_players
      WHERE open_game_id = _existing_game_id AND player_id = _user
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_joined');
    END IF;
    INSERT INTO open_game_players (open_game_id, player_id)
    VALUES (_existing_game_id, _user);
    RETURN jsonb_build_object(
      'ok', true, 'joined', true,
      'open_game_id', _existing_game_id,
      'booking_id', _existing_booking_id
    );
  END IF;

  SELECT c.id INTO _free_court
  FROM courts c
  WHERE c.venue_id = _venue AND c.sport = _sport
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.court_id = c.id AND b.date = _date AND b.status <> 'cancelled'
        AND b.start_time < _end_time
        AND (b.start_time::interval + (b.duration_hours || ' hours')::interval)::time > _start
    )
  ORDER BY c.name LIMIT 1;

  IF _free_court IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_court');
  END IF;

  BEGIN
    INSERT INTO bookings (
      court_id, venue_id, player_id, date, start_time,
      duration_hours, type, status, price
    ) VALUES (
      _free_court, _venue, _user, _date, _start,
      _duration, 'online', 'confirmed', _slot_price
    ) RETURNING id INTO _booking_id;
  EXCEPTION WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_court');
  END;

  INSERT INTO open_games (
    venue_id, sport, date, start_time, max_players, host_id, booking_id
  ) VALUES (
    _venue, _sport, _date, _start, _max_players, _user, _booking_id
  ) RETURNING id INTO _open_game_id;

  RETURN jsonb_build_object(
    'ok', true, 'joined', false,
    'open_game_id', _open_game_id,
    'booking_id', _booking_id
  );
END;
$function$;
