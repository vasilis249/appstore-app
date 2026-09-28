-- Instagram-style social layer: usernames, followers (with private accounts),
-- posts (+ likes, comments), 24h stories, content reports, DM requests and
-- accurate match statistics. Client writes to follows go through RPCs; all
-- other tables are protected by RLS built on can_view_profile().

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles: username, bio, private flag
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9._]{3,30}$'),
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 150);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);

-- Latin handle from a (possibly Greek) name, made unique with a numeric suffix.
-- Never derived from an email address, which would leak it publicly.
CREATE OR REPLACE FUNCTION public.generate_username(_seed text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  s text := lower(coalesce(_seed, ''));
  candidate text;
BEGIN
  IF position('@' IN s) > 0 THEN
    s := '';
  END IF;
  s := translate(s, 'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ');
  s := replace(replace(replace(replace(s, 'θ', 'th'), 'χ', 'ch'), 'ψ', 'ps'), 'ξ', 'ks');
  s := replace(replace(replace(s, 'ου', 'ou'), 'μπ', 'mp'), 'ντ', 'nt');
  s := translate(s, 'αβγδεζηικλμνοπρστυφω', 'avgdeziiklmnoprstyfo');
  s := regexp_replace(s, '\s+', '.', 'g');
  s := regexp_replace(s, '[^a-z0-9._]', '', 'g');
  s := regexp_replace(s, '\.{2,}', '.', 'g');
  s := trim(BOTH '.' FROM s);
  IF char_length(s) < 3 THEN
    s := 'player';
  END IF;
  s := left(s, 24);
  candidate := s;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    candidate := s || (1000 + floor(random() * 9000))::int::text;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_set_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NULL THEN
    NEW.username := public.generate_username(NEW.full_name);
  ELSE
    NEW.username := lower(NEW.username);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_username ON public.profiles;
CREATE TRIGGER profiles_set_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_username();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, full_name FROM public.profiles WHERE username IS NULL LOOP
    UPDATE public.profiles SET username = public.generate_username(r.full_name) WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- Players could previously PATCH their own rating / games_played / disabled
-- flag through PostgREST ("Users can update own profile"). Those are now
-- system-managed: direct client writes keep the old values.
CREATE OR REPLACE FUNCTION public.profiles_guard_system_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER -- current_user identifies a direct client write
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.rating := OLD.rating;
    NEW.games_played := OLD.games_played;
    NEW.disabled := OLD.disabled;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_system_columns ON public.profiles;
CREATE TRIGGER profiles_guard_system_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_system_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Visibility helpers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Follows
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON public.follows (following_id, status);
CREATE INDEX follows_follower_idx ON public.follows (follower_id, status);

-- Can _viewer see _target's posts, stories and follower lists?
CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _viewer IS NOT NULL AND (
    _viewer = _target
    OR public.has_role(_viewer, 'admin')
    OR (
      NOT public.is_blocked_between(_viewer, _target)
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

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

CREATE POLICY "Follows visible to participants and profile viewers"
ON public.follows FOR SELECT TO authenticated
USING (
  auth.uid() IN (follower_id, following_id)
  OR (
    status = 'accepted'
    AND (public.can_view_profile(auth.uid(), following_id) OR public.can_view_profile(auth.uid(), follower_id))
  )
);

-- Follow someone. Private accounts get a pending request. Returns the status.
CREATE OR REPLACE FUNCTION public.follow_user(_target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _status text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF _me = _target THEN RAISE EXCEPTION 'cannot_follow_self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target AND disabled = false) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  IF public.is_blocked_between(_me, _target) THEN RAISE EXCEPTION 'blocked'; END IF;

  SELECT CASE WHEN is_private THEN 'pending' ELSE 'accepted' END INTO _status
  FROM public.profiles WHERE user_id = _target;

  INSERT INTO public.follows (follower_id, following_id, status, accepted_at)
  VALUES (_me, _target, _status, CASE WHEN _status = 'accepted' THEN now() END)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  SELECT status INTO _status FROM public.follows WHERE follower_id = _me AND following_id = _target;
  RETURN _status;
END;
$$;

-- Unfollow, or cancel a pending request.
CREATE OR REPLACE FUNCTION public.unfollow_user(_target uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.follows WHERE follower_id = auth.uid() AND following_id = _target;
$$;

CREATE OR REPLACE FUNCTION public.accept_follow_request(_follower uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.follows SET status = 'accepted', accepted_at = now()
  WHERE follower_id = _follower AND following_id = auth.uid() AND status = 'pending';
$$;

-- Reject a pending request or remove an existing follower.
CREATE OR REPLACE FUNCTION public.remove_follower(_follower uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.follows WHERE follower_id = _follower AND following_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.follow_user(uuid), public.unfollow_user(uuid),
  public.accept_follow_request(uuid), public.remove_follower(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_user(uuid), public.unfollow_user(uuid),
  public.accept_follow_request(uuid), public.remove_follower(uuid) TO authenticated;

-- Going public accepts all pending requests.
CREATE OR REPLACE FUNCTION public.profiles_accept_pending_on_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_private AND NOT NEW.is_private THEN
    UPDATE public.follows SET status = 'accepted', accepted_at = now()
    WHERE following_id = NEW.user_id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_accept_pending_on_public ON public.profiles;
CREATE TRIGGER profiles_accept_pending_on_public
  AFTER UPDATE OF is_private ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_accept_pending_on_public();

-- Blocking removes follows in both directions.
CREATE OR REPLACE FUNCTION public.user_blocks_drop_follows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_blocks_drop_follows ON public.user_blocks;
CREATE TRIGGER user_blocks_drop_follows
  AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.user_blocks_drop_follows();

-- Existing friendships become follows: accepted = mutual, pending = requester follows.
INSERT INTO public.follows (follower_id, following_id, status, created_at, accepted_at)
SELECT requester_id, addressee_id, 'accepted', created_at, COALESCE(responded_at, created_at)
FROM public.friendships WHERE status IN ('accepted', 'pending')
ON CONFLICT DO NOTHING;
INSERT INTO public.follows (follower_id, following_id, status, created_at, accepted_at)
SELECT addressee_id, requester_id, 'accepted', COALESCE(responded_at, created_at), COALESCE(responded_at, created_at)
FROM public.friendships WHERE status = 'accepted'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Posts, likes, comments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'match')),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 2200),
  -- Storage paths in the social-media bucket, always under "<author_id>/".
  media text[] NOT NULL DEFAULT '{}' CHECK (cardinality(media) <= 5),
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  open_game_id uuid REFERENCES public.open_games(id) ON DELETE SET NULL,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'match' OR cardinality(media) >= 1)
);
CREATE INDEX posts_author_created_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX posts_created_idx ON public.posts (created_at DESC);

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_likes_user_idx ON public.post_likes (user_id);

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_comments_post_idx ON public.post_comments (post_id, created_at);

CREATE OR REPLACE FUNCTION public.can_view_post(_viewer uuid, _post uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post AND public.can_view_profile(_viewer, p.author_id)
  );
$$;

-- Match posts must reference the author's own booking / open game.
CREATE OR REPLACE FUNCTION public.post_refs_valid(_author uuid, _booking uuid, _open_game uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (_booking IS NULL OR EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.id = _booking AND b.player_id = _author))
     AND (_open_game IS NULL OR EXISTS (
            SELECT 1 FROM public.open_games og WHERE og.id = _open_game AND (
              og.host_id = _author
              OR EXISTS (SELECT 1 FROM public.open_game_players p
                         WHERE p.open_game_id = og.id AND p.player_id = _author))));
$$;

CREATE OR REPLACE FUNCTION public.posts_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER -- current_user identifies a direct client write
SET search_path = public
AS $$
DECLARE
  _path text;
BEGIN
  -- Counter updates from post_counters() run as the function owner: let them through.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  FOREACH _path IN ARRAY NEW.media LOOP
    IF split_part(_path, '/', 1) <> NEW.author_id::text THEN
      RAISE EXCEPTION 'invalid_media_path' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NOT public.post_refs_valid(NEW.author_id, NEW.booking_id, NEW.open_game_id) THEN
    RAISE EXCEPTION 'invalid_match_reference' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Authors may edit the caption only; counters and ownership are system-managed.
    NEW.like_count := OLD.like_count;
    NEW.comment_count := OLD.comment_count;
    NEW.author_id := OLD.author_id;
    NEW.kind := OLD.kind;
    NEW.media := OLD.media;
    NEW.booking_id := OLD.booking_id;
    NEW.open_game_id := OLD.open_game_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  ELSE
    NEW.like_count := 0;
    NEW.comment_count := 0;
    NEW.created_at := now();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_validate
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_validate();

CREATE OR REPLACE FUNCTION public.post_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  _post uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.post_id ELSE OLD.post_id END;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    UPDATE public.posts SET like_count = greatest(like_count + _delta, 0) WHERE id = _post;
  ELSE
    UPDATE public.posts SET comment_count = greatest(comment_count + _delta, 0) WHERE id = _post;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_likes_counter AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.post_counters();
CREATE TRIGGER post_comments_counter AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.post_counters();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts, public.post_likes, public.post_comments TO authenticated;
GRANT ALL ON public.posts, public.post_likes, public.post_comments TO service_role;

CREATE POLICY "Posts visible to allowed viewers" ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_profile(auth.uid(), author_id));
CREATE POLICY "Authors create posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors edit posts" ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or admins delete posts" ON public.posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Likes visible with the post" ON public.post_likes FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id));
CREATE POLICY "Users like visible posts" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_post(auth.uid(), post_id));
CREATE POLICY "Users unlike" ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Comments visible with the post" ON public.post_comments FOR SELECT TO authenticated
  USING (
    public.can_view_post(auth.uid(), post_id)
    AND NOT public.is_blocked_between(auth.uid(), author_id)
  );
CREATE POLICY "Users comment on visible posts" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_post(auth.uid(), post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND public.is_blocked_between(auth.uid(), p.author_id)
    )
  );
CREATE POLICY "Comment author, post author or admin delete" ON public.post_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Stories (24h)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_path text NOT NULL,
  caption text CHECK (caption IS NULL OR char_length(caption) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CHECK (split_part(media_path, '/', 1) = author_id::text)
);
CREATE INDEX stories_author_expires_idx ON public.stories (author_id, expires_at DESC);

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

-- Stories can't be back-dated or extended by the client.
CREATE OR REPLACE FUNCTION public.stories_set_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();
  NEW.expires_at := now() + interval '24 hours';
  RETURN NEW;
END;
$$;
CREATE TRIGGER stories_set_expiry BEFORE INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.stories_set_expiry();

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.stories, public.story_views TO service_role;

CREATE POLICY "Active stories visible to allowed viewers" ON public.stories FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR (expires_at > now() AND public.can_view_profile(auth.uid(), author_id)));
CREATE POLICY "Authors create stories" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or admins delete stories" ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Viewers and story authors see views" ON public.story_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
  );
CREATE POLICY "Viewers record their own views" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.expires_at > now() AND public.can_view_profile(auth.uid(), s.author_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Storage: private bucket, "<user_id>/..." paths, read access = can_view_profile
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('social-media', 'social-media', false, 10 * 1024 * 1024,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.try_uuid(_s text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN _s::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE POLICY "Social media readable by allowed viewers" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'social-media'
    AND public.can_view_profile(auth.uid(), public.try_uuid((storage.foldername(name))[1]))
  );
CREATE POLICY "Users upload own social media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own social media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Content reports (posts, comments, stories, profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'story', 'profile')),
  target_id uuid NOT NULL,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  UNIQUE (reporter_id, target_type, target_id)
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

CREATE POLICY "Users file reports" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open');
CREATE POLICY "Reporters and admins see reports" ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins resolve reports" ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. DM requests: a conversation stays in "Requests" until the member accepts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Match statistics: games actually played (past, not cancelled), per sport
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.player_match_stats(_user uuid)
RETURNS TABLE (sport public.sport, matches bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH played AS (
    -- Court bookings made by the player
    SELECT b.id AS match_id, c.sport
    FROM public.bookings b
    JOIN public.courts c ON c.id = b.court_id
    WHERE b.player_id = _user
      AND b.status IN ('confirmed', 'completed')
      AND (b.date + b.start_time) < (now() AT TIME ZONE 'Europe/Athens')
    UNION
    -- Open games the player joined (the host's game is the booking above)
    SELECT COALESCE(og.booking_id, og.id) AS match_id, og.sport
    FROM public.open_game_players p
    JOIN public.open_games og ON og.id = p.open_game_id
    LEFT JOIN public.bookings b ON b.id = og.booking_id
    WHERE p.player_id = _user
      AND (b.id IS NULL OR b.status IN ('confirmed', 'completed'))
      AND (og.date + og.start_time) < (now() AT TIME ZONE 'Europe/Athens')
  )
  SELECT sport, count(DISTINCT match_id) FROM played GROUP BY sport;
$$;

REVOKE EXECUTE ON FUNCTION public.player_match_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_match_stats(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Notifications for follows, likes and comments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid;
  _recipient uuid;
  _name text;
BEGIN
  IF TG_TABLE_NAME = 'follows' THEN
    _actor := NEW.follower_id;
    _recipient := NEW.following_id;
    SELECT COALESCE(full_name, username) INTO _name FROM public.profiles WHERE user_id = _actor;
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (_recipient, 'follow_request', 'Νέο αίτημα ακολούθησης',
              COALESCE(_name, 'Ένας παίκτης') || ' θέλει να σε ακολουθήσει.',
              jsonb_build_object('user_id', _actor));
    ELSIF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (_recipient, 'new_follower', 'Νέος ακόλουθος',
              COALESCE(_name, 'Ένας παίκτης') || ' σε ακολουθεί.',
              jsonb_build_object('user_id', _actor));
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      SELECT COALESCE(full_name, username) INTO _name FROM public.profiles WHERE user_id = _recipient;
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (_actor, 'follow_accepted', 'Το αίτημά σου έγινε δεκτό',
              COALESCE(_name, 'Ένας παίκτης') || ' αποδέχθηκε το αίτημα ακολούθησης.',
              jsonb_build_object('user_id', _recipient));
    END IF;
    RETURN NEW;
  END IF;

  SELECT author_id INTO _recipient FROM public.posts WHERE id = NEW.post_id;
  -- Separate branches: plpgsql can't reference a column the row type doesn't have.
  IF TG_TABLE_NAME = 'post_likes' THEN
    _actor := NEW.user_id;
  ELSE
    _actor := NEW.author_id;
  END IF;
  IF _recipient IS NULL OR _recipient = _actor THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(full_name, username) INTO _name FROM public.profiles WHERE user_id = _actor;
  IF TG_TABLE_NAME = 'post_likes' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (_recipient, 'post_like', 'Νέο like', COALESCE(_name, 'Ένας παίκτης') || ' έκανε like στη δημοσίευσή σου.',
            jsonb_build_object('post_id', NEW.post_id, 'user_id', _actor));
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (_recipient, 'post_comment', 'Νέο σχόλιο',
            COALESCE(_name, 'Ένας παίκτης') || ': ' || left(NEW.body, 80),
            jsonb_build_object('post_id', NEW.post_id, 'user_id', _actor, 'comment_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER follows_notify AFTER INSERT OR UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_social();
CREATE TRIGGER post_likes_notify AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_social();
CREATE TRIGGER post_comments_notify AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_social();

-- Internal helpers are not callable by clients.
REVOKE EXECUTE ON FUNCTION public.generate_username(text), public.notify_social(),
  public.post_counters(), public.user_blocks_drop_follows(),
  public.profiles_accept_pending_on_public() FROM PUBLIC, anon, authenticated;
