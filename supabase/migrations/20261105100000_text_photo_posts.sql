-- Posts like X (user request 2026-10-14): any mix of text (≤ 280, the `title` column), up to 4 photos (`images`,
-- paths in the public `voices` bucket under your own folder, same policies / sweeper / account deletion) and a voice.
-- A plain repost is now "repost_of and no content" (`plain_repost`), no longer "no audio".
-- feed_posts / create_post / admin_reports below = their previous definitions (pg_get_functiondef) with the edits.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg',
                               'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'voices';

ALTER TABLE public.posts ADD COLUMN images text[] CHECK (cardinality(images) BETWEEN 1 AND 4);
ALTER TABLE public.posts ADD COLUMN plain_repost boolean GENERATED ALWAYS AS (
  repost_of IS NOT NULL AND audio_path IS NULL AND title IS NULL AND images IS NULL AND deleted_at IS NULL) STORED;
CREATE INDEX posts_images_idx ON public.posts USING gin (images);
DROP INDEX public.posts_one_plain_repost;
CREATE UNIQUE INDEX posts_one_plain_repost ON public.posts (author_id, repost_of) WHERE plain_repost;
ALTER TABLE public.posts DROP CONSTRAINT posts_title_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_title_check CHECK (char_length(title) BETWEEN 1 AND 280);
ALTER TABLE public.posts DROP CONSTRAINT posts_kind_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_kind_check CHECK (
  (audio_path IS NULL) = (mime IS NULL) AND (audio_path IS NULL) = (duration_ms IS NULL)
  AND CASE WHEN deleted_at IS NOT NULL THEN audio_path IS NULL AND title IS NULL AND images IS NULL
           ELSE audio_path IS NOT NULL OR title IS NOT NULL OR images IS NOT NULL OR repost_of IS NOT NULL END);

-- "No audio" meant "plain repost" in these; now a text or photo post has no audio either.
DO $patch$
DECLARE
  fixes text[][] := ARRAY[
    ['private.remove_post', 'c.repost_of = p_post AND c.audio_path IS NOT NULL', 'c.repost_of = p_post AND NOT c.plain_repost'],
    ['private.remove_post', 'repost_of = p_post AND audio_path IS NULL AND deleted_at IS NULL', 'repost_of = p_post AND plain_repost'],
    ['private.remove_post', 'duration_ms = NULL, title = NULL,', 'duration_ms = NULL, title = NULL, images = NULL,'],
    ['public.unrepost', 'repost_of = p_post AND audio_path IS NULL', 'repost_of = p_post AND plain_repost'],
    ['private.profile_deleting', '(c.audio_path IS NOT NULL OR c.deleted_at IS NOT NULL)', 'NOT c.plain_repost'],
    ['private.orphan_voice_files', 'WHERE p.audio_path = o.name', 'WHERE p.audio_path = o.name OR p.images @> ARRAY[o.name]']];
  f text[];
  fn regprocedure;
  def text;
BEGIN
  FOREACH f SLICE 1 IN ARRAY fixes LOOP
    fn := to_regproc(f[1])::oid::regprocedure;  -- each name is unique within its schema
    def := pg_get_functiondef(fn);
    IF position(f[2] IN def) = 0 THEN RAISE EXCEPTION 'patch % not found in %', f[2], f[1]; END IF;
    EXECUTE replace(def, f[2], f[3]);
  END LOOP;
END $patch$;

DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid);
CREATE FUNCTION public.feed_posts(p_scope text, p_section text DEFAULT NULL::text, p_topic uuid DEFAULT NULL::uuid, p_author uuid DEFAULT NULL::uuid, p_parent uuid DEFAULT NULL::uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_ids uuid[] DEFAULT NULL::uuid[], p_group uuid DEFAULT NULL::uuid)
 RETURNS TABLE(post_id uuid, created_at timestamp with time zone, author_id uuid, author_username text, author_name text, author_avatar text, section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text, duration_ms integer, likes_count integer, replies_count integer, reposts_count integer, listens_count integer, liked boolean, reposted boolean, is_mine boolean, orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text, orig_audio_path text, orig_duration_ms integer, orig_created_at timestamp with time zone, orig_author_id uuid, orig_likes_count integer, orig_replies_count integer, orig_reposts_count integer, orig_listens_count integer, reply_to_username text, group_id uuid, group_name text, deleted boolean, orig_deleted boolean, university_id text, author_university_id text, author_department_id text, images text[], orig_images text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.me();
  my_uni text := private.my_university();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('foryou', 'all', 'following', 'section', 'topic', 'author', 'author_replies', 'replies', 'one', 'ids',
                     'group', 'groups', 'news', 'personal', 'loose', 'campus') THEN
    RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id, p.created_at, a.id, a.username, a.full_name, a.avatar_path,
         p.section_id, p.topic_id, t.title, p.reply_to, p.repost_of, p.title, p.audio_path,
         p.duration_ms, p.likes_count, p.replies_count, p.reposts_count, p.listens_count,
         EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = coalesce(CASE WHEN p.plain_repost THEN p.repost_of END, p.id) AND l.user_id = uid),
         EXISTS (SELECT 1 FROM public.posts r WHERE r.repost_of = coalesce(CASE WHEN p.plain_repost THEN p.repost_of END, p.id) AND r.author_id = uid AND r.plain_repost),
         coalesce(p.author_id = uid, false),
         oa.username, oa.full_name, oa.avatar_path, o.title, o.audio_path, o.duration_ms, o.created_at, o.author_id,
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count,
         ra.username, p.group_id, g.name, p.deleted_at IS NOT NULL, coalesce(o.deleted_at IS NOT NULL, false),
         p.university_id, a.university_id, a.department_id, p.images, o.images
  FROM public.posts p
  LEFT JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  LEFT JOIN public.groups g ON g.id = p.group_id
  WHERE NOT p.hidden
    AND CASE WHEN p.deleted_at IS NULL THEN NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
             ELSE p_scope IN ('replies', 'one', 'ids') END
    AND (o.id IS NULL OR o.deleted_at IS NOT NULL
         OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p.group_id IS NULL OR private.can_see_group(uid, p.group_id))
    AND (p.university_id IS NULL OR p.university_id = my_uni)
    AND (p_before IS NULL OR p_scope IN ('foryou', 'news', 'one', 'ids')
         OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'foryou' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND NOT p.plain_repost
                         AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL
      WHEN 'following' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL
                            AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'news' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL
                       AND NOT p.plain_repost AND p.created_at > now() - interval '30 days'
      WHEN 'loose' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL
                        AND p.topic_id IS NULL AND (o.id IS NULL OR o.topic_id IS NULL)
                        AND (p_section IS NULL OR p.section_id = p_section)
      WHEN 'personal' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NULL
                           AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'campus' THEN my_uni IS NOT NULL AND p.university_id = my_uni AND p.reply_to IS NULL
                         AND (p_section IS NULL OR p.section_id = p_section)
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
END $function$;

DROP FUNCTION public.create_post(text, uuid, uuid, uuid, text, text, text, int, uuid, boolean);
CREATE FUNCTION public.create_post(p_section text DEFAULT NULL::text, p_topic uuid DEFAULT NULL::uuid, p_reply_to uuid DEFAULT NULL::uuid, p_repost_of uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_mime text DEFAULT NULL::text, p_duration_ms integer DEFAULT NULL::integer, p_group uuid DEFAULT NULL::uuid, p_campus boolean DEFAULT false, p_images text[] DEFAULT NULL::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.me();
  v_section text := p_section;
  v_topic uuid := p_topic;
  v_group uuid := p_group;
  v_uni text;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_images text[] := nullif(p_images, '{}');
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
    v_uni := parent.university_id;
  ELSIF p_repost_of IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_repost_of;
    -- group and campus voices stay where they are
    IF NOT FOUND OR NOT private.can_see_post(p_repost_of) OR parent.plain_repost OR parent.deleted_at IS NOT NULL
       OR parent.group_id IS NOT NULL OR parent.university_id IS NOT NULL THEN
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
    SELECT t.section_id, t.university_id INTO v_section, v_uni FROM public.topics t WHERE t.id = v_topic AND NOT t.hidden;
    IF NOT FOUND OR (v_uni IS NOT NULL AND v_uni IS DISTINCT FROM private.my_university()) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_campus THEN
    v_uni := private.my_university();
    IF v_uni IS NULL THEN RAISE EXCEPTION 'not_verified' USING ERRCODE = '42501'; END IF;
  END IF;
  -- only members speak in a group (replies included)
  IF v_group IS NOT NULL AND private.group_role(uid, v_group) IS NULL THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  -- a section must exist and match: student sections for campus voices, the others for everything else
  IF v_section IS NOT NULL AND p_reply_to IS NULL AND v_group IS NULL AND NOT EXISTS (
       SELECT 1 FROM public.sections s WHERE s.id = v_section AND s.kind = CASE WHEN v_uni IS NULL THEN 'news' ELSE 'campus' END) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;

  -- like X: any mix of text (≤ 280), up to 4 photos and a voice; only a plain repost is empty
  IF p_path IS NULL AND v_title IS NULL AND v_images IS NULL AND p_repost_of IS NULL THEN
    RAISE EXCEPTION 'empty_post' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) > 280 THEN RAISE EXCEPTION 'too_long' USING ERRCODE = '22023'; END IF;
  IF p_path IS NOT NULL AND (NOT starts_with(p_path, uid::text || '/') OR char_length(p_path) > 200
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voices' AND name = p_path)) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_images) > 4 OR cardinality(v_images) <> (SELECT count(DISTINCT x) FROM unnest(v_images) x)
     OR EXISTS (SELECT 1 FROM unnest(v_images) x
                WHERE x IS NULL OR NOT starts_with(x, uid::text || '/') OR char_length(x) > 200 OR x = p_path
                   OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'voices' AND o.name = x)) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM private.rate_limit('post', 30, interval '1 hour');
  INSERT INTO public.posts (author_id, section_id, topic_id, reply_to, repost_of, title, audio_path, mime, duration_ms,
                            group_id, university_id, images)
  VALUES (uid, v_section, v_topic, p_reply_to, p_repost_of, v_title, p_path,
          CASE WHEN p_path IS NULL THEN NULL ELSE private.normalize_audio_mime(p_mime) END,
          CASE WHEN p_path IS NULL THEN NULL ELSE p_duration_ms END, v_group, v_uni, v_images)
  RETURNING id INTO pid;
  RETURN pid;
END $function$;

DROP FUNCTION public.admin_reports(boolean, int);
CREATE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, kind text, reason text, created_at timestamp with time zone, resolved_at timestamp with time zone, action text, reporter_username text, target_user_id uuid, target_username text, target_name text, target_avatar text, target_disabled boolean, target_is_admin boolean, target_id uuid, post_title text, post_audio_path text, post_duration_ms integer, post_hidden boolean, post_exists boolean, reports_on_target integer, group_name text, group_exists boolean, post_images text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.me();
  admin boolean := private.is_admin(uid);
  mod_uni text := private.moderates(uid);
BEGIN
  IF NOT admin AND mod_uni IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT r.id, r.kind, r.reason, r.created_at, r.resolved_at, r.action,
         CASE WHEN admin THEN rp.username END, u.id, u.username, u.full_name, u.avatar_path, u.disabled,
         private.is_admin(u.id), r.target_id,
         p.title, p.audio_path, p.duration_ms, p.hidden, p.id IS NOT NULL AND p.deleted_at IS NULL,
         (SELECT count(*)::int FROM public.reports o
          WHERE o.resolved_at IS NULL AND o.kind = r.kind
            AND CASE WHEN r.kind IN ('post', 'group') THEN o.target_id = r.target_id ELSE o.target_user_id = r.target_user_id END),
         g.name, g.id IS NOT NULL, p.images
  FROM public.reports r
  JOIN public.profiles u ON u.id = r.target_user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
  LEFT JOIN public.groups g ON r.kind = 'group' AND g.id = r.target_id
  WHERE (r.resolved_at IS NULL) = coalesce(p_open, true)
    AND (admin OR (r.kind = 'post' AND p.university_id = mod_uni))
  ORDER BY CASE WHEN coalesce(p_open, true) THEN r.created_at END ASC,
           r.resolved_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $function$;

REVOKE EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_post(text, uuid, uuid, uuid, text, text, text, int, uuid, boolean, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reports(boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_post(text, uuid, uuid, uuid, text, text, text, int, uuid, boolean, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reports(boolean, int) TO authenticated, service_role;
