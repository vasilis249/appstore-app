-- Speak: Home in three parts — News (voices filed in a section: current affairs, tech, sports …), Following
-- (personal voices from people you follow, not tied to any news) and Groups. A voice with no section, topic,
-- group or parent is now a personal one (posts.section_id NULL); replies and reposts keep their parent's kind.
--   feed_posts scopes: 'news' = ranked like For you, sections only; 'personal' = personal voices of the people
--   you follow and yours, newest first.

ALTER TABLE public.posts ALTER COLUMN section_id DROP NOT NULL;
CREATE INDEX posts_personal ON public.posts (author_id, created_at DESC)
  WHERE section_id IS NULL AND group_id IS NULL AND reply_to IS NULL AND NOT hidden;

CREATE OR REPLACE FUNCTION public.create_post(
  p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_reply_to uuid DEFAULT NULL,
  p_repost_of uuid DEFAULT NULL, p_title text DEFAULT NULL, p_path text DEFAULT NULL,
  p_mime text DEFAULT NULL, p_duration_ms int DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_section text := p_section;
  v_topic uuid := p_topic;
  v_group uuid := p_group;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  parent public.posts;
  pid uuid;
BEGIN
  IF p_reply_to IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_reply_to;
    IF NOT FOUND OR NOT private.can_see_post(p_reply_to) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_section := parent.section_id;
    v_topic := parent.topic_id;
    v_group := parent.group_id;
  ELSIF p_repost_of IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_repost_of;
    -- group voices stay in their group
    IF NOT FOUND OR NOT private.can_see_post(p_repost_of) OR parent.audio_path IS NULL OR parent.group_id IS NOT NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_section := parent.section_id;
    v_topic := NULL;
    v_group := NULL;
  ELSIF v_group IS NOT NULL THEN
    SELECT section_id INTO v_section FROM public.groups WHERE id = v_group;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
    v_topic := NULL;
  ELSIF v_topic IS NOT NULL THEN
    SELECT section_id INTO v_section FROM public.topics WHERE id = v_topic AND NOT hidden;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  -- only members speak in a group (replies included)
  IF v_group IS NOT NULL AND private.group_role(uid, v_group) IS NULL THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  -- No section (and no topic / group / parent) = a personal voice; a section that doesn't exist is an error.
  IF v_section IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sections WHERE id = v_section) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;

  IF p_path IS NULL THEN
    IF p_repost_of IS NULL OR v_title IS NOT NULL THEN
      RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
    END IF;
  ELSIF NOT starts_with(p_path, uid::text || '/') OR char_length(p_path) > 200
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voices' AND name = p_path) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM private.rate_limit('post', 30, interval '1 hour');
  INSERT INTO public.posts (author_id, section_id, topic_id, reply_to, repost_of, title, audio_path, mime, duration_ms, group_id)
  VALUES (uid, v_section, v_topic, p_reply_to, p_repost_of, left(v_title, 100), p_path,
          CASE WHEN p_path IS NULL THEN NULL ELSE private.normalize_audio_mime(p_mime) END,
          CASE WHEN p_path IS NULL THEN NULL ELSE p_duration_ms END, v_group)
  RETURNING id INTO pid;
  RETURN pid;
END $$;

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
                     'group', 'groups', 'news', 'personal') THEN
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

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
