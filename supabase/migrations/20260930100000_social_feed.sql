-- Social round 2/3: saved posts, feed + explore queries, story tray.
-- All read helpers are SECURITY INVOKER, so RLS (can_view_profile) still decides visibility.

-- Saved posts ("bookmarks"), private to the user who saved them.
CREATE TABLE public.post_saves (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_saves_user_idx ON public.post_saves (user_id, created_at DESC);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT ALL ON public.post_saves TO service_role;

CREATE POLICY "Users see own saves" ON public.post_saves FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users save visible posts" ON public.post_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_post(auth.uid(), post_id));
CREATE POLICY "Users unsave" ON public.post_saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Home feed: own posts + posts of accounts I follow (accepted), newest first.
CREATE OR REPLACE FUNCTION public.feed_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 10)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE (
      p.author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = p.author_id AND f.status = 'accepted'
      )
    )
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(_limit, 1), 30);
$$;

-- Explore: recent posts I can see from people I don't follow yet (RLS hides private/blocked).
CREATE OR REPLACE FUNCTION public.explore_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 30)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.author_id <> auth.uid()
    AND cardinality(p.media) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = p.author_id AND f.status = 'accepted'
    )
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(_limit, 1), 60);
$$;

-- Story tray: one row per author with active stories I can see (me + accounts I follow).
CREATE OR REPLACE FUNCTION public.story_tray()
RETURNS TABLE (author_id uuid, latest_at timestamptz, story_count bigint, has_unseen boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.author_id,
         max(s.created_at) AS latest_at,
         count(*) AS story_count,
         bool_or(NOT EXISTS (
           SELECT 1 FROM public.story_views v WHERE v.story_id = s.id AND v.viewer_id = auth.uid()
         )) AS has_unseen
  FROM public.stories s
  WHERE s.expires_at > now()
    AND (
      s.author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = s.author_id AND f.status = 'accepted'
      )
    )
  GROUP BY s.author_id
  ORDER BY (s.author_id = auth.uid()) DESC, bool_or(NOT EXISTS (
           SELECT 1 FROM public.story_views v WHERE v.story_id = s.id AND v.viewer_id = auth.uid()
         )) DESC, max(s.created_at) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.feed_posts(timestamptz, integer), public.explore_posts(timestamptz, integer),
  public.story_tray() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_posts(timestamptz, integer), public.explore_posts(timestamptz, integer),
  public.story_tray() TO authenticated;

-- Notifications: users mark their own as read (column read_at already exists).
-- Story replies and post shares travel as DM messages that reference the item.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;
