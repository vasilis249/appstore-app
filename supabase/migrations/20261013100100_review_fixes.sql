-- Fixes from a review:
--  • 'loose' ("Other voices": section voices not about a headline) also listed plain reposts of voices that ARE
--    about a headline (a repost doesn't carry the topic, so the topic count isn't doubled).
--  • Cancelling a join request left the "X asked to join" notification on the admins' bell.
--  • News cards: a speaker without a name showed as "" → fall back to the username.

CREATE OR REPLACE FUNCTION public.feed_posts(
  p_scope text, p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_author uuid DEFAULT NULL,
  p_parent uuid DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 20,
  p_offset int DEFAULT 0, p_ids uuid[] DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS TABLE (
  post_id uuid, created_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text,
  duration_ms int, likes_count int, replies_count int, reposts_count int, listens_count int,
  liked boolean, reposted boolean, is_mine boolean,
  orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text,
  orig_audio_path text, orig_duration_ms int, orig_created_at timestamptz, orig_author_id uuid,
  orig_likes_count int, orig_replies_count int, orig_reposts_count int, orig_listens_count int,
  reply_to_username text, group_id uuid, group_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('foryou', 'all', 'following', 'section', 'topic', 'author', 'author_replies', 'replies', 'one', 'ids',
                     'group', 'groups', 'news', 'personal', 'loose') THEN
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
         ra.username, p.group_id, g.name
  FROM public.posts p
  JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  LEFT JOIN public.groups g ON g.id = p.group_id
  WHERE NOT p.hidden AND NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
    AND (o.id IS NULL OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p.group_id IS NULL OR private.can_see_group(uid, p.group_id))
    AND (p_before IS NULL OR p_scope IN ('foryou', 'news', 'one', 'ids')
         OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'foryou' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.audio_path IS NOT NULL AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.group_id IS NULL AND p.reply_to IS NULL
      WHEN 'following' THEN p.group_id IS NULL AND p.reply_to IS NULL AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'news' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL AND p.audio_path IS NOT NULL
                       AND p.created_at > now() - interval '30 days'
      WHEN 'loose' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL AND p.topic_id IS NULL
                        AND (o.id IS NULL OR o.topic_id IS NULL)
                        AND (p_section IS NULL OR p.section_id = p_section)
      WHEN 'personal' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NULL
                           AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'group' THEN p.group_id = p_group AND p.reply_to IS NULL
      WHEN 'groups' THEN p.reply_to IS NULL
                         AND p.group_id IN (SELECT m.group_id FROM public.group_members m WHERE m.user_id = uid)
      WHEN 'one' THEN p.id = p_parent
      WHEN 'ids' THEN p.id = ANY (p_ids)
      ELSE p.reply_to = p_parent
    END
  ORDER BY
    CASE WHEN p_scope IN ('foryou', 'news') THEN
      (1 + p.likes_count * 3 + p.replies_count * 4 + p.reposts_count * 5 + p.listens_count)::float8
      * CASE WHEN private.follows(uid, p.author_id) THEN 1.5 ELSE 1 END
      * CASE WHEN p.author_id = uid THEN 0.5 ELSE 1 END
      / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.5)
    END DESC NULLS LAST,
    CASE WHEN p_scope = 'ids' THEN array_position(p_ids, p.id) END ASC NULLS LAST,
    CASE WHEN p_scope = 'replies' THEN p.created_at END ASC NULLS LAST,
    p.created_at DESC
  OFFSET CASE WHEN p_scope IN ('foryou', 'news') THEN least(greatest(coalesce(p_offset, 0), 0), 1000) ELSE 0 END
  LIMIT lim;
END $$;

CREATE OR REPLACE FUNCTION public.leave_group(p_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  DELETE FROM public.group_requests WHERE group_id = p_group AND user_id = uid;
  DELETE FROM public.group_members WHERE group_id = p_group AND user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid AND group_id = p_group AND kind = 'group_invite';
  -- a cancelled request shouldn't stay on the admins' bell
  DELETE FROM public.notifications WHERE actor_id = uid AND group_id = p_group AND kind = 'group_request';
END $$;

CREATE OR REPLACE FUNCTION public.news_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, image_url text,
               created_at timestamptz, last_post_at timestamptz, posts_count int, speakers_count int, speakers jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.image_url, t.created_at, t.last_post_at,
         t.posts_count,
         (SELECT count(DISTINCT p.author_id)::int FROM public.posts p
          WHERE p.topic_id = t.id AND p.reply_to IS NULL AND NOT p.hidden),
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('name', coalesce(nullif(btrim(s.full_name), ''), s.username), 'avatar_path', s.avatar_path) ORDER BY s.last DESC)
           FROM (
             SELECT a.full_name, a.username, a.avatar_path, max(p.created_at) AS last
             FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
             WHERE p.topic_id = t.id AND p.reply_to IS NULL AND NOT p.hidden AND NOT a.disabled
               AND NOT private.is_blocked(uid, a.id)
             GROUP BY a.id, a.full_name, a.username, a.avatar_path
             ORDER BY last DESC LIMIT 3
           ) s), '[]'::jsonb)
  FROM public.topics t
  WHERE NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY t.pinned DESC, greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC
  LIMIT least(greatest(coalesce(p_limit, 15), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
