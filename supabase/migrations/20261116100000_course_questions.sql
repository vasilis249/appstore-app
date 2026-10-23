-- Course Q&A + notification settings (product directive O2, user OK 2026-10-23).
--   1. A course question = a campus post in «Ερωτήσεις» tied to a course (posts.course_id); answers are its replies,
--      so voice / text / photos, likes, reports and reply notices all work as for any post. Everyone who takes the
--      course («Το δίνω») hears about new questions (one unread notice per course, counting them).
--   2. The asker marks one answer as helpful (posts.helpful_reply_id); its author is told.
--   3. Push per category: students switch off phone notifications for messages / replies / courses / reactions /
--      people / groups. The in-app list keeps everything; only the push to the phone is skipped.

-- ---------------------------------------------------------------------------
-- 1. Questions and helpful answers
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  ADD COLUMN helpful_reply_id uuid REFERENCES public.posts (id) ON DELETE SET NULL,
  ADD CONSTRAINT posts_course_question CHECK (course_id IS NULL OR (university_id IS NOT NULL AND reply_to IS NULL));
CREATE INDEX posts_course ON public.posts (course_id, created_at DESC) WHERE course_id IS NOT NULL AND NOT hidden;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'follow', 'like', 'reply', 'repost', 'report', 'group_invite', 'group_request', 'group_accepted', 'group_joined',
  'invite_joined', 'walkie', 'nearby', 'file_thanks', 'files_helped', 'course_file', 'course_question', 'answer_helpful'));

-- Ask in a course of your university: a campus post in «Ερωτήσεις» (same checks, limits and files as create_post).
CREATE FUNCTION public.ask_course_question(p_course uuid, p_title text DEFAULT NULL, p_path text DEFAULT NULL,
  p_mime text DEFAULT NULL, p_duration_ms int DEFAULT NULL, p_images text[] DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE courses.id = p_course AND university_id = private.my_university()) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  v_id := public.create_post(p_section := 'questions', p_title := p_title, p_path := p_path, p_mime := p_mime,
                           p_duration_ms := p_duration_ms, p_campus := true, p_images := p_images);
  UPDATE public.posts SET course_id = p_course WHERE posts.id = v_id;
  WITH t AS (
    SELECT k.user_id FROM public.course_takers k
    WHERE k.course_id = p_course AND k.user_id <> uid AND NOT private.is_blocked(k.user_id, uid)
  ), prev AS (
    DELETE FROM public.notifications n USING t
    WHERE n.user_id = t.user_id AND n.kind = 'course_question' AND n.course_id = p_course AND n.read_at IS NULL
    RETURNING n.user_id, n.count
  )
  INSERT INTO public.notifications (user_id, actor_id, kind, course_id, post_id, count)
  SELECT t.user_id, uid, 'course_question', p_course, v_id, 1 + coalesce(max(prev.count), 0)
  FROM t LEFT JOIN prev ON prev.user_id = t.user_id GROUP BY t.user_id;
  RETURN v_id;
END $$;

-- The asker marks one direct answer as helpful (another one replaces it; NULL takes it back).
CREATE FUNCTION public.mark_helpful_answer(p_question uuid, p_reply uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  q public.posts;
  r public.posts;
BEGIN
  SELECT * INTO q FROM public.posts WHERE id = p_question;
  IF NOT FOUND OR q.author_id IS DISTINCT FROM uid OR q.reply_to IS NOT NULL OR q.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_reply IS NOT NULL THEN
    SELECT * INTO r FROM public.posts WHERE id = p_reply;
    IF NOT FOUND OR r.reply_to IS DISTINCT FROM p_question OR r.deleted_at IS NOT NULL OR r.author_id = uid
       OR NOT private.can_see_post(p_reply) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  IF q.helpful_reply_id IS NOT DISTINCT FROM p_reply THEN RETURN; END IF;
  UPDATE public.posts SET helpful_reply_id = p_reply WHERE id = p_question;
  DELETE FROM public.notifications WHERE kind = 'answer_helpful' AND actor_id = uid AND post_id = q.helpful_reply_id;
  IF p_reply IS NOT NULL AND NOT private.is_blocked(r.author_id, uid) THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id, course_id)
    VALUES (r.author_id, uid, 'answer_helpful', p_reply, q.course_id);
  END IF;
END $$;

-- The campus section «Μαθήματα» (posts about studies) would share its name with the new Courses tab: «Σπουδές».
UPDATE public.sections SET name_el = 'Σπουδές', name_en = 'Studies' WHERE id = 'courses';

-- ---------------------------------------------------------------------------
-- 2. feed_posts: scope 'course' (a course's questions, newest first) + course / helpful columns
-- ---------------------------------------------------------------------------
DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid);
CREATE FUNCTION public.feed_posts(p_scope text, p_section text DEFAULT NULL::text, p_topic uuid DEFAULT NULL::uuid, p_author uuid DEFAULT NULL::uuid, p_parent uuid DEFAULT NULL::uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_ids uuid[] DEFAULT NULL::uuid[], p_group uuid DEFAULT NULL::uuid, p_course uuid DEFAULT NULL::uuid)
 RETURNS TABLE(post_id uuid, created_at timestamp with time zone, author_id uuid, author_username text, author_name text, author_avatar text, section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text, duration_ms integer, likes_count integer, replies_count integer, reposts_count integer, listens_count integer, liked boolean, reposted boolean, is_mine boolean, orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text, orig_audio_path text, orig_duration_ms integer, orig_created_at timestamp with time zone, orig_author_id uuid, orig_likes_count integer, orig_replies_count integer, orig_reposts_count integer, orig_listens_count integer, reply_to_username text, group_id uuid, group_name text, deleted boolean, orig_deleted boolean, university_id text, author_university_id text, author_department_id text, images text[], orig_images text[], course_id uuid, course_name text, helpful_reply_id uuid, is_helpful boolean)
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
                     'group', 'groups', 'news', 'personal', 'loose', 'campus', 'course') THEN
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
         p.university_id, a.university_id, a.department_id, p.images, o.images,
         p.course_id, c.name, p.helpful_reply_id, coalesce(rp.helpful_reply_id = p.id, false)
  FROM public.posts p
  LEFT JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  LEFT JOIN public.groups g ON g.id = p.group_id
  LEFT JOIN public.courses c ON c.id = p.course_id
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
      WHEN 'course' THEN my_uni IS NOT NULL AND p.course_id = p_course AND p.reply_to IS NULL
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

-- ---------------------------------------------------------------------------
-- 3. Push settings per category (the in-app list is unaffected)
-- ---------------------------------------------------------------------------
CREATE TABLE private.push_mutes (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('messages', 'replies', 'courses', 'reactions', 'people', 'groups')),
  PRIMARY KEY (user_id, category)
);

CREATE FUNCTION private.notification_category(p_kind text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_kind IN ('dm', 'walkie', 'nearby') THEN 'messages'
    WHEN p_kind = 'reply' THEN 'replies'
    WHEN p_kind IN ('course_file', 'course_question') THEN 'courses'
    WHEN p_kind IN ('like', 'repost', 'file_thanks', 'files_helped', 'answer_helpful') THEN 'reactions'
    WHEN p_kind IN ('follow', 'invite_joined') THEN 'people'
    WHEN p_kind LIKE 'group\_%' THEN 'groups'
  END -- NULL (reports to staff): always sent
$$;

CREATE FUNCTION public.my_push_settings()
RETURNS TABLE (category text, push boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c, NOT EXISTS (SELECT 1 FROM private.push_mutes m WHERE m.user_id = auth.uid() AND m.category = c)
  FROM unnest(ARRAY['messages', 'replies', 'courses', 'reactions', 'people', 'groups']) WITH ORDINALITY AS x(c, i)
  WHERE auth.uid() IS NOT NULL
  ORDER BY i
$$;

CREATE FUNCTION public.set_push_setting(p_category text, p_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me_any();
BEGIN
  IF p_category NOT IN ('messages', 'replies', 'courses', 'reactions', 'people', 'groups') THEN
    RAISE EXCEPTION 'bad_category' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_on, true) THEN
    DELETE FROM private.push_mutes WHERE user_id = uid AND category = p_category;
  ELSE
    INSERT INTO private.push_mutes (user_id, category) VALUES (uid, p_category) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.push_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cfg private.push_config;
  who uuid;
  kind text;
BEGIN
  IF TG_TABLE_NAME = 'voice_messages' THEN who := NEW.recipient_id; kind := 'dm'; ELSE who := NEW.user_id; kind := NEW.kind; END IF;
  SELECT * INTO cfg FROM private.push_config;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM private.push_tokens WHERE user_id = who)
     OR EXISTS (SELECT 1 FROM private.push_mutes m WHERE m.user_id = who AND m.category = private.notification_category(kind)) THEN
    RETURN NULL;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := cfg.url,
      body := jsonb_build_object('kind', CASE WHEN TG_TABLE_NAME = 'voice_messages' THEN 'dm' ELSE 'n' END, 'id', NEW.id::text),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
      timeout_milliseconds := 5000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch: %', SQLERRM; -- never lose the notification itself
  END;
  RETURN NULL;
END $$;

-- push texts for the two new kinds (edit the live definition in place: the rest of push_job stays as it is)
DO $push$
DECLARE d text := pg_get_functiondef('private.push_job(text, text)'::regprocedure);
BEGIN
  IF position($a$WHEN n.kind = 'course_file' THEN course_name$a$ IN d) = 0
     OR position($a$WHEN n.kind IN ('like', 'reply', 'repost') THEN '/p/' || n.post_id$a$ IN d) = 0
     OR position($a$      WHEN n.kind = 'course_file' THEN CASE WHEN coalesce(n.count, 1) > 1$a$ IN d) = 0 THEN
    RAISE EXCEPTION 'push_job changed: update this migration';
  END IF;
  d := replace(d, $a$WHEN n.kind = 'course_file' THEN course_name$a$,
                  $a$WHEN n.kind IN ('course_file', 'course_question') THEN course_name$a$);
  d := replace(d, $a$WHEN n.kind IN ('like', 'reply', 'repost') THEN '/p/' || n.post_id$a$,
                  $a$WHEN n.kind IN ('like', 'reply', 'repost', 'course_question', 'answer_helpful') THEN '/p/' || n.post_id$a$);
  d := replace(d, $a$      WHEN n.kind = 'course_file' THEN CASE WHEN coalesce(n.count, 1) > 1$a$,
    $a$      WHEN n.kind = 'course_question' THEN CASE WHEN coalesce(n.count, 1) > 1
                                            THEN format(CASE WHEN l.en THEN '%s new questions, latest: %s' ELSE '%s νέες ερωτήσεις, η πιο πρόσφατη: %s' END, n.count, post_title)
                                            ELSE concat(name, CASE WHEN l.en THEN ' asked: ' ELSE ' ρώτησε: ' END, post_title) END
      WHEN n.kind = 'answer_helpful' THEN CASE WHEN l.en THEN 'marked your answer as helpful ✓' ELSE 'σημείωσε την απάντησή σου ως βοηθητική ✓' END
      WHEN n.kind = 'course_file' THEN CASE WHEN coalesce(n.count, 1) > 1$a$);
  EXECUTE d;
END $push$;

REVOKE EXECUTE ON FUNCTION private.notification_category(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid, uuid),
  public.ask_course_question(uuid, text, text, text, int, text[]), public.mark_helpful_answer(uuid, uuid),
  public.my_push_settings(), public.set_push_setting(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid, uuid),
  public.ask_course_question(uuid, text, text, text, int, text[]), public.mark_helpful_answer(uuid, uuid),
  public.my_push_settings(), public.set_push_setting(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid, uuid) TO service_role;
