-- Security hardening (audit before going live).
--  1. Helper functions can't be used to probe other users (follows, blocks, roles, chats).
--  2. Venues: only owners create them; approval, rating and ownership are admin/system-managed.
--  3. Reviews: only between players of the same finished game, one per game, not yourself.
--  4. Open games: joins only through join_open_game(); games must belong to a real booking.
--  5. Notifications: clients may only mark them read; social duplicates are dropped.
--  6. Rate limits on posts, comments, stories, follows and reports.
--  7. Public buckets can't be listed (public URLs keep working).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Private implementations + guarded public wrappers
--    PostgREST only exposes `public`, so functions in `private` can't be called
--    as RPCs. The public names stay (RLS policies reference them) but only answer
--    for the caller themself when invoked by an end user (anon/authenticated).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- True when the request comes from an end user and `_who` is not that user.
CREATE OR REPLACE FUNCTION private.is_probe(_who uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND _who IS DISTINCT FROM auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer IS NOT NULL AND (
    _viewer = _target
    OR private.has_role(_viewer, 'admin')
    OR (
      NOT private.is_blocked_between(_viewer, _target)
      AND (
        NOT COALESCE((SELECT is_private FROM public.profiles WHERE user_id = _target), false)
        OR EXISTS (
          SELECT 1 FROM public.follows
          WHERE follower_id = _viewer AND following_id = _target AND status = 'accepted'
        )
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_post(_viewer uuid, _post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post AND private.can_view_profile(_viewer, p.author_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_user_id) AND private.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (NOT private.is_probe(_a) OR NOT private.is_probe(_b)) AND private.is_blocked_between(_a, _b);
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_viewer) AND private.can_view_profile(_viewer, _target);
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(_viewer uuid, _post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_viewer) AND private.can_view_post(_viewer, _post);
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_user) AND EXISTS (
    SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_user) AND EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.post_refs_valid(_author uuid, _booking uuid, _open_game uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_probe(_author)
     AND (_booking IS NULL OR EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.id = _booking AND b.player_id = _author))
     AND (_open_game IS NULL OR EXISTS (
            SELECT 1 FROM public.open_games og WHERE og.id = _open_game AND (
              og.host_id = _author
              OR EXISTS (SELECT 1 FROM public.open_game_players p
                         WHERE p.open_game_id = og.id AND p.player_id = _author))));
$$;

-- Mentions notify other people, so they need the unguarded check.
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid;
  _post uuid;
  _text text;
  _skip uuid;
  _name text;
  _target uuid;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    _actor := NEW.author_id; _post := NEW.id; _text := NEW.caption; _skip := NULL;
  ELSE
    _actor := NEW.author_id; _post := NEW.post_id; _text := NEW.body;
    SELECT author_id INTO _skip FROM public.posts WHERE id = NEW.post_id;
  END IF;
  IF _text IS NULL OR position('@' IN _text) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(full_name, username) INTO _name FROM public.profiles WHERE user_id = _actor;
  FOR _target IN
    SELECT DISTINCT p.user_id
    FROM (SELECT (regexp_matches(_text, '@([a-z0-9._]{3,30})', 'g'))[1] AS u LIMIT 20) m
    JOIN public.profiles p ON p.username = m.u
    WHERE p.user_id <> _actor
      AND p.user_id IS DISTINCT FROM _skip
      AND NOT private.is_blocked_between(_actor, p.user_id)
      AND private.can_view_post(p.user_id, _post)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      _target, 'mention', 'Σε ανέφεραν',
      COALESCE(_name, 'Ένας παίκτης') || ' σε ανέφερε: ' || left(_text, 80),
      jsonb_build_object('post_id', _post, 'user_id', _actor)
        || CASE WHEN TG_TABLE_NAME = 'post_comments' THEN jsonb_build_object('comment_id', NEW.id) ELSE '{}'::jsonb END
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Guards below run for end-user requests only (JWT role "authenticated"); the web
-- server's service role and migrations are trusted.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Venues
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.venues_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_role(auth.uid(), 'owner') THEN
      RAISE EXCEPTION 'only_owners_create_venues' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.owner_id := auth.uid();
    NEW.approved := false;
    NEW.rating := 0;
    NEW.reviews_count := 0;
    NEW.rejection_reason := NULL;
  ELSE
    NEW.owner_id := OLD.owner_id;
    NEW.approved := OLD.approved;
    NEW.rating := OLD.rating;
    NEW.reviews_count := OLD.reviews_count;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS venues_guard ON public.venues;
CREATE TRIGGER venues_guard BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.venues_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Reviews
-- ─────────────────────────────────────────────────────────────────────────────
-- A player took part in a game as host or as a joined player.
CREATE OR REPLACE FUNCTION private.played_in(_user uuid, _game uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.open_games WHERE id = _game AND host_id = _user)
      OR EXISTS (SELECT 1 FROM public.open_game_players WHERE open_game_id = _game AND player_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.reviews_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Only the rating and the comment can change.
    NEW.reviewer_id := OLD.reviewer_id;
    NEW.target_player_id := OLD.target_player_id;
    NEW.open_game_id := OLD.open_game_id;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;
  NEW.created_at := now();
  IF NEW.target_player_id = NEW.reviewer_id THEN
    RAISE EXCEPTION 'cannot_review_self' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.open_game_id IS NULL
     OR NOT private.played_in(NEW.reviewer_id, NEW.open_game_id)
     OR NOT private.played_in(NEW.target_player_id, NEW.open_game_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.open_games og
       WHERE og.id = NEW.open_game_id
         AND (og.date + og.start_time) < (now() AT TIME ZONE 'Europe/Athens')
     ) THEN
    RAISE EXCEPTION 'review_requires_shared_finished_game' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.comment IS NOT NULL AND char_length(NEW.comment) > 500 THEN
    RAISE EXCEPTION 'comment_too_long' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reviews_guard ON public.reviews;
CREATE TRIGGER reviews_guard BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_guard();

-- One review per reviewer, player and game (keep the newest if duplicates exist).
DELETE FROM public.reviews a USING public.reviews b
WHERE a.reviewer_id = b.reviewer_id AND a.target_player_id = b.target_player_id
  AND a.open_game_id = b.open_game_id AND (a.created_at, a.id) < (b.created_at, b.id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_game
  ON public.reviews (reviewer_id, target_player_id, open_game_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Open games
-- ─────────────────────────────────────────────────────────────────────────────
-- Joining only through join_open_game() (capacity, time, blocks are checked there).
DROP POLICY IF EXISTS "Players join open games" ON public.open_game_players;
REVOKE INSERT, UPDATE, TRUNCATE ON public.open_game_players FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_open_game(_open_game_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _game public.open_games%ROWTYPE;
  _count int;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF private.has_role(_user, 'owner') AND NOT private.has_role(_user, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_open_game_id::text, 0));
  SELECT * INTO _game FROM public.open_games WHERE id = _open_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF (_game.date + _game.start_time) <= (now() AT TIME ZONE 'Europe/Athens') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'started');
  END IF;
  IF _game.booking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings WHERE id = _game.booking_id AND status = 'cancelled'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cancelled');
  END IF;
  IF private.is_blocked_between(_user, _game.host_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF _game.host_id = _user
     OR EXISTS (SELECT 1 FROM public.open_game_players WHERE open_game_id = _open_game_id AND player_id = _user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_joined');
  END IF;
  SELECT COUNT(*) INTO _count FROM public.open_game_players WHERE open_game_id = _open_game_id;
  IF (1 + _count) >= _game.max_players THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;
  INSERT INTO public.open_game_players (open_game_id, player_id) VALUES (_open_game_id, _user);
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_open_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_open_game(uuid) TO authenticated;

-- A client-created game must match a booking the caller made or owns the venue of;
-- afterwards only notes / level / size can change.
CREATE OR REPLACE FUNCTION public.open_games_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.max_players IS NULL OR NEW.max_players < 2 OR NEW.max_players > private.max_players_for(NEW.sport) THEN
    RAISE EXCEPTION 'invalid_max_players' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.notes IS NOT NULL AND char_length(NEW.notes) > 500 THEN
    RAISE EXCEPTION 'notes_too_long' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.host_id := OLD.host_id;
    NEW.venue_id := OLD.venue_id;
    NEW.booking_id := OLD.booking_id;
    NEW.date := OLD.date;
    NEW.start_time := OLD.start_time;
    NEW.sport := OLD.sport;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;
  IF NEW.booking_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = NEW.booking_id
      AND b.venue_id = NEW.venue_id
      AND b.date = NEW.date
      AND b.start_time = NEW.start_time
      AND b.status <> 'cancelled'
      AND (b.player_id = auth.uid() OR v.owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'open_game_requires_booking' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS open_games_guard ON public.open_games;
CREATE TRIGGER open_games_guard BEFORE INSERT OR UPDATE ON public.open_games
  FOR EACH ROW EXECUTE FUNCTION public.open_games_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Notifications
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notifications FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Like/unlike or follow/unfollow loops must not spam the same person.
CREATE OR REPLACE FUNCTION private.notifications_dedupe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type IN ('post_like', 'new_follower', 'follow_request', 'follow_accepted', 'mention')
     AND EXISTS (
       SELECT 1 FROM public.notifications
       WHERE user_id = NEW.user_id AND type = NEW.type AND data = NEW.data
         AND created_at > now() - interval '1 day'
     ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_dedupe ON public.notifications;
CREATE TRIGGER notifications_dedupe BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION private.notifications_dedupe();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Rate limits for end users: TG_ARGV = (owner column, window, max rows)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n int;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  EXECUTE format(
    'SELECT count(*) FROM %I.%I WHERE %I = $1 AND created_at > now() - $2::interval',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV[0]
  ) INTO _n USING auth.uid(), TG_ARGV[1];
  IF _n >= TG_ARGV[2]::int THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_rate_limit ON public.posts;
CREATE TRIGGER posts_rate_limit BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '1 hour', '20');
DROP TRIGGER IF EXISTS post_comments_rate_limit ON public.post_comments;
CREATE TRIGGER post_comments_rate_limit BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '1 minute', '15');
DROP TRIGGER IF EXISTS stories_rate_limit ON public.stories;
CREATE TRIGGER stories_rate_limit BEFORE INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '1 hour', '30');
DROP TRIGGER IF EXISTS follows_rate_limit ON public.follows;
CREATE TRIGGER follows_rate_limit BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('follower_id', '1 hour', '200');
DROP TRIGGER IF EXISTS content_reports_rate_limit ON public.content_reports;
CREATE TRIGGER content_reports_rate_limit BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('reporter_id', '1 hour', '30');
DROP TRIGGER IF EXISTS reviews_rate_limit ON public.reviews;
CREATE TRIGGER reviews_rate_limit BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION private.rate_limit('reviewer_id', '1 hour', '30');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6b. Player bookings are validated in the database too (the booking RPCs can be
--     called directly): approved venue, a real slot of that court and weekday,
--     the slot duration (padel: fixed 1.5h), no closure, at most 180 days ahead.
--     Owner phone/closed bookings and service-role writes are not affected.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.validate_player_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sport public.sport;
  _approved boolean;
  _slot_len numeric;
  _dow int := extract(dow FROM NEW.date)::int;
  _end time;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' OR NEW.type <> 'online'
     OR private.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  SELECT v.sport, v.approved INTO _sport, _approved FROM public.venues v WHERE v.id = NEW.venue_id;
  IF NOT COALESCE(_approved, false) THEN
    RAISE EXCEPTION 'venue_not_found' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.date > (now() AT TIME ZONE 'Europe/Athens')::date + 180 THEN
    RAISE EXCEPTION 'too_far_ahead' USING ERRCODE = 'check_violation';
  END IF;
  SELECT extract(epoch FROM (cs.end_time - cs.start_time)) / 3600 INTO _slot_len
  FROM public.court_slots cs
  WHERE cs.court_id = NEW.court_id AND cs.day_of_week = _dow AND cs.start_time = NEW.start_time
  LIMIT 1;
  IF _slot_len IS NULL
     OR NEW.duration_hours <> (CASE WHEN _sport = 'padel' THEN 1.5 ELSE _slot_len END) THEN
    RAISE EXCEPTION 'invalid_slot' USING ERRCODE = 'check_violation';
  END IF;
  _end := (NEW.start_time::interval + (NEW.duration_hours || ' hours')::interval)::time;
  IF EXISTS (
    SELECT 1 FROM public.court_closures cc
    WHERE cc.court_id = NEW.court_id
      AND (cc.date = NEW.date OR (cc.date IS NULL AND cc.weekday = _dow))
      AND cc.start_time < _end AND cc.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'court_closed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bookings_validate_player ON public.bookings;
CREATE TRIGGER bookings_validate_player BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.validate_player_booking();

-- Open-game size per sport (the slot RPC takes it as a parameter).
CREATE OR REPLACE FUNCTION private.max_players_for(_sport public.sport)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _sport
    WHEN 'padel' THEN 4 WHEN 'tennis' THEN 4 WHEN 'beach_volley' THEN 4
    WHEN 'volleyball' THEN 12 WHEN 'basketball' THEN 10 WHEN 'football' THEN 14
    ELSE 30 END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Storage: public buckets serve files by URL; nobody needs to list them.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can view venue photos" ON storage.objects;

-- Internal helpers are not callable by clients.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.venues_guard(), public.reviews_guard(), public.open_games_guard()
  FROM PUBLIC, anon, authenticated;
