
-- Atomic slot booking: either joins an existing open_game at the slot (if it
-- has room) or creates a new booking + open_game on a free court. Uses a
-- transaction-scoped advisory lock keyed on venue+date+start to serialize
-- concurrent attempts on the same slot.
CREATE OR REPLACE FUNCTION public.create_slot_booking(
  _venue uuid,
  _date date,
  _start time,
  _duration numeric,
  _max_players int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _sport sport;
  _price numeric;
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

  -- Past slot guard (server time is UTC; preview uses Europe/Athens — give 1 min grace)
  IF _slot_ts <= (now() AT TIME ZONE 'Europe/Athens') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'past_slot');
  END IF;

  -- Serialize concurrent attempts on the same venue/date/slot
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_venue::text || '|' || _date::text || '|' || _start::text, 0)
  );

  SELECT v.sport, v.base_price_per_hour INTO _sport, _price
  FROM venues v WHERE v.id = _venue;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_not_found');
  END IF;

  -- Same-user overlap check (any venue, any booking type the user owns)
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

  -- Existing open game at this slot?
  SELECT og.id, og.booking_id, og.max_players
  INTO _existing_game_id, _existing_booking_id, _existing_max
  FROM open_games og
  WHERE og.venue_id = _venue AND og.date = _date AND og.start_time = _start
  LIMIT 1;

  IF _existing_game_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _player_count
    FROM open_game_players WHERE open_game_id = _existing_game_id;
    -- host counts implicitly
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

  -- No existing slot game → find a free court and create booking + open_game
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

  INSERT INTO bookings (
    court_id, venue_id, player_id, date, start_time,
    duration_hours, type, status, price
  ) VALUES (
    _free_court, _venue, _user, _date, _start,
    _duration, 'online', 'confirmed', _price * _duration
  ) RETURNING id INTO _booking_id;

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
$$;

REVOKE ALL ON FUNCTION public.create_slot_booking(uuid, date, time, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time, numeric, int) TO authenticated;


-- Atomic whole-court booking: locks the venue+date+start slot, validates past
-- time, same-user overlap, and finds a free court. Used by the player flow
-- ("ολόκληρο γήπεδο") and any other path that needs guaranteed exclusivity.
CREATE OR REPLACE FUNCTION public.create_whole_booking(
  _venue uuid,
  _date date,
  _start time,
  _duration numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO bookings (
    court_id, venue_id, player_id, date, start_time,
    duration_hours, type, status, price
  ) VALUES (
    _free_court, _venue, _user, _date, _start,
    _duration, 'online', 'confirmed', _price * _duration
  ) RETURNING id INTO _booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', _booking_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_whole_booking(uuid, date, time, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time, numeric) TO authenticated;
