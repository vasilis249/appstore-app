-- Speak S5: ranked "For you", reply threads (ancestors, "replying to @x"), replies on profiles,
-- better trending topics. feed_posts gains p_offset / p_ids and a reply_to_username column → drop + create.

DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int);

-- Scopes:
--   'foryou'  ranked (engagement with time decay, people you follow boosted; plain reposts left out; p_offset paging)
--   'all' | 'following' | 'section' | 'topic' | 'author'  newest first, top-level only (p_before cursor)
--   'author_replies'  someone's replies, newest first
--   'replies'  replies to p_parent, oldest first
--   'one'  the post p_parent;  'ids'  the posts in p_ids, in that order (thread ancestors)
CREATE FUNCTION public.feed_posts(
  p_scope text, p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_author uuid DEFAULT NULL,
  p_parent uuid DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 20,
  p_offset int DEFAULT 0, p_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  post_id uuid, created_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text,
  duration_ms int, likes_count int, replies_count int, reposts_count int, listens_count int,
  liked boolean, reposted boolean, is_mine boolean,
  orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text,
  orig_audio_path text, orig_duration_ms int, orig_created_at timestamptz, orig_author_id uuid,
  orig_likes_count int, orig_replies_count int, orig_reposts_count int, orig_listens_count int,
  reply_to_username text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('foryou', 'all', 'following', 'section', 'topic', 'author', 'author_replies', 'replies', 'one', 'ids') THEN
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
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count,
         ra.username
  FROM public.posts p
  JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  WHERE NOT p.hidden AND NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
    AND (o.id IS NULL OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p_before IS NULL OR p_scope IN ('foryou', 'one', 'ids')
         OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'foryou' THEN p.reply_to IS NULL AND p.audio_path IS NOT NULL AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.reply_to IS NULL
      WHEN 'following' THEN p.reply_to IS NULL AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'one' THEN p.id = p_parent
      WHEN 'ids' THEN p.id = ANY (p_ids)
      ELSE p.reply_to = p_parent
    END
  ORDER BY
    CASE WHEN p_scope = 'foryou' THEN
      (1 + p.likes_count * 3 + p.replies_count * 4 + p.reposts_count * 5 + p.listens_count)::float8
      * CASE WHEN private.follows(uid, p.author_id) THEN 1.5 ELSE 1 END
      * CASE WHEN p.author_id = uid THEN 0.5 ELSE 1 END
      / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.5)
    END DESC NULLS LAST,
    CASE WHEN p_scope = 'ids' THEN array_position(p_ids, p.id) END ASC NULLS LAST,
    CASE WHEN p_scope = 'replies' THEN p.created_at END ASC NULLS LAST,
    p.created_at DESC
  OFFSET CASE WHEN p_scope = 'foryou' THEN least(greatest(coalesce(p_offset, 0), 0), 1000) ELSE 0 END
  LIMIT lim;
END $$;

-- The reply chain above a post, root first (visible posts only, at most 20 levels).
CREATE FUNCTION public.post_ancestors(p_post uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  ids uuid[];
BEGIN
  WITH RECURSIVE up AS (
    SELECT p.reply_to AS id, 1 AS depth FROM public.posts p WHERE p.id = p_post AND p.reply_to IS NOT NULL
    UNION ALL
    SELECT p.reply_to, up.depth + 1 FROM up JOIN public.posts p ON p.id = up.id
    WHERE p.reply_to IS NOT NULL AND up.depth < 20
  )
  SELECT array_agg(up.id ORDER BY up.depth DESC) INTO ids FROM up WHERE private.can_see_post(up.id);
  RETURN coalesce(ids, ARRAY[]::uuid[]);
END $$;

-- Trending topics: pinned first, then activity in the last 24 h (voices, then their likes/replies/listens).
CREATE OR REPLACE FUNCTION public.trending_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text,
               created_at timestamptz, posts_count int, recent_posts int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT p.topic_id, count(*)::int AS n,
           sum(p.likes_count * 2 + p.replies_count * 3 + p.listens_count)::float8 AS engagement
    FROM public.posts p
    WHERE p.topic_id IS NOT NULL AND p.reply_to IS NULL AND NOT p.hidden AND p.created_at > now() - interval '24 hours'
    GROUP BY p.topic_id
  )
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.created_at, t.posts_count,
         coalesce(r.n, 0)
  FROM public.topics t
  LEFT JOIN recent r ON r.topic_id = t.id
  WHERE NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND t.created_at > now() - interval '14 days'
  ORDER BY t.pinned DESC, coalesce(r.n, 0) * 10 + coalesce(r.engagement, 0) DESC, t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
