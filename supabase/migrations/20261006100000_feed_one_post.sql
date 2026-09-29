-- feed_posts: scope 'one' (a single post, for its page) and the original's author id + counters on
-- reposts (a plain repost shows the original's likes/replies/reposts/listens). New OUT columns → drop + create.
DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int);
-- The one feed query. Scopes:
--   'all' (For you; recency for now), 'following' (people I follow + me), 'section' (p_section),
--   'topic' (p_topic), 'author' (p_author), 'replies' (replies to p_parent, oldest first),
--   'one' (just the post p_parent, for its page).
-- Plain reposts carry the original post in the orig_* columns.
CREATE FUNCTION public.feed_posts(
  p_scope text, p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_author uuid DEFAULT NULL,
  p_parent uuid DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS TABLE (
  post_id uuid, created_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text,
  duration_ms int, likes_count int, replies_count int, reposts_count int, listens_count int,
  liked boolean, reposted boolean, is_mine boolean,
  orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text,
  orig_audio_path text, orig_duration_ms int, orig_created_at timestamptz, orig_author_id uuid,
  orig_likes_count int, orig_replies_count int, orig_reposts_count int, orig_listens_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('all', 'following', 'section', 'topic', 'author', 'replies', 'one') THEN
    RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id, p.created_at, a.id, a.username, a.full_name, a.avatar_path,
         p.section_id, p.topic_id, t.title, p.reply_to, p.repost_of, p.title, p.audio_path,
         p.duration_ms, p.likes_count, p.replies_count, p.reposts_count, p.listens_count,
         EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND l.user_id = uid),
         EXISTS (SELECT 1 FROM public.posts r WHERE r.repost_of = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND r.author_id = uid AND r.audio_path IS NULL),
         p.author_id = uid,
         oa.username, oa.full_name, oa.avatar_path, o.title, o.audio_path, o.duration_ms, o.created_at, o.author_id,
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count
  FROM public.posts p
  JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  WHERE NOT p.hidden AND NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
    AND (o.id IS NULL OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p_before IS NULL OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'all' THEN p.reply_to IS NULL
      WHEN 'following' THEN p.reply_to IS NULL AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'one' THEN p.id = p_parent
      ELSE p.reply_to = p_parent
    END
  ORDER BY CASE WHEN p_scope = 'replies' THEN extract(epoch FROM p.created_at) ELSE -extract(epoch FROM p.created_at) END
  LIMIT lim;
END $$;

REVOKE EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int) TO authenticated, service_role;
