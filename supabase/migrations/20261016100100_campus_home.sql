-- Campus-first Home (N2). A campus voice (posts.university_id) is heard only by verified students of that university
-- (like a private group), filed in a student section (Μαθήματα, Εξεταστική, …) or none, and can't be reposted or
-- quoted out of the campus; replies stay in it. Campus topics (topics.university_id): the university's own topic of
-- the day and its news (NTUA's RSS: Νέα + Ανακοινώσεις). Global feeds, news and trends never show campus content.

-- ---------------------------------------------------------------------------
-- 1. Student sections
-- ---------------------------------------------------------------------------
ALTER TABLE public.sections ADD COLUMN kind text NOT NULL DEFAULT 'news' CHECK (kind IN ('news', 'campus'));
INSERT INTO public.sections (id, position, name_el, name_en, icon, kind) VALUES
  ('courses', 101, 'Μαθήματα', 'Courses', 'book-open', 'campus'),
  ('exams', 102, 'Εξεταστική', 'Exams', 'pencil', 'campus'),
  ('campuslife', 103, 'Φοιτητική ζωή', 'Student life', 'party-popper', 'campus'),
  ('housing', 104, 'Στέγαση', 'Housing', 'house', 'campus'),
  ('events', 105, 'Events', 'Events', 'calendar', 'campus'),
  ('market', 106, 'Αγγελίες', 'Marketplace', 'tag', 'campus'),
  ('questions', 107, 'Ερωτήσεις', 'Questions', 'circle-help', 'campus'),
  ('announcements', 108, 'Ανακοινώσεις', 'Announcements', 'megaphone', 'campus');

-- ---------------------------------------------------------------------------
-- 2. Campus on posts and topics; who may see them
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN university_id text REFERENCES public.universities (id) ON DELETE CASCADE;
CREATE INDEX posts_campus ON public.posts (university_id, created_at DESC)
  WHERE university_id IS NOT NULL AND reply_to IS NULL AND NOT hidden;
ALTER TABLE public.topics ADD COLUMN university_id text REFERENCES public.universities (id) ON DELETE CASCADE;
-- one topic of the day per day for everyone, and one per day for each campus
ALTER TABLE public.topics DROP CONSTRAINT topics_daily_date_key;
CREATE UNIQUE INDEX topics_daily_per_campus ON public.topics (coalesce(university_id, ''), daily_date) WHERE daily_date IS NOT NULL;

CREATE FUNCTION private.my_university()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY topics_select ON public.topics;
CREATE POLICY topics_select ON public.topics FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid())
         OR (NOT hidden AND (university_id IS NULL OR university_id = private.my_university())));

CREATE OR REPLACE FUNCTION private.can_see_post(p_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
    WHERE p.id = p_post AND NOT p.hidden AND NOT a.disabled
      AND NOT private.is_blocked(auth.uid(), p.author_id)
      AND (p.group_id IS NULL OR private.can_see_group(auth.uid(), p.group_id))
      AND (p.university_id IS NULL OR p.university_id = private.my_university()))
$$;

CREATE OR REPLACE FUNCTION private.can_see_tombstone(p_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.posts t
                 WHERE t.id = p_post AND t.deleted_at IS NOT NULL AND NOT t.hidden
                   AND (t.group_id IS NULL OR private.can_see_group(auth.uid(), t.group_id))
                   AND (t.university_id IS NULL OR t.university_id = private.my_university()))
$$;

-- ---------------------------------------------------------------------------
-- 3. Posting: p_campus = a voice for your campus (verified students only)
-- ---------------------------------------------------------------------------
DROP FUNCTION public.create_post(text, uuid, uuid, uuid, text, text, text, int, uuid);
CREATE FUNCTION public.create_post(
  p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_reply_to uuid DEFAULT NULL,
  p_repost_of uuid DEFAULT NULL, p_title text DEFAULT NULL, p_path text DEFAULT NULL,
  p_mime text DEFAULT NULL, p_duration_ms int DEFAULT NULL, p_group uuid DEFAULT NULL, p_campus boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_section text := p_section;
  v_topic uuid := p_topic;
  v_group uuid := p_group;
  v_uni text;
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
    v_uni := parent.university_id;
  ELSIF p_repost_of IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_repost_of;
    -- group and campus voices stay where they are
    IF NOT FOUND OR NOT private.can_see_post(p_repost_of) OR parent.audio_path IS NULL
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

  IF p_path IS NULL THEN
    IF p_repost_of IS NULL OR v_title IS NOT NULL THEN
      RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
    END IF;
  ELSIF NOT starts_with(p_path, uid::text || '/') OR char_length(p_path) > 200
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voices' AND name = p_path) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM private.rate_limit('post', 30, interval '1 hour');
  INSERT INTO public.posts (author_id, section_id, topic_id, reply_to, repost_of, title, audio_path, mime, duration_ms,
                            group_id, university_id)
  VALUES (uid, v_section, v_topic, p_reply_to, p_repost_of, left(v_title, 100), p_path,
          CASE WHEN p_path IS NULL THEN NULL ELSE private.normalize_audio_mime(p_mime) END,
          CASE WHEN p_path IS NULL THEN NULL ELSE p_duration_ms END, v_group, v_uni)
  RETURNING id INTO pid;
  RETURN pid;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Feeds: scope 'campus' (your university, newest first, optional section); campus voices nowhere else;
--    + columns university_id, author_university_id, author_department_id (for the "ΕΜΠ · ΗΜΜΥ" badge)
-- ---------------------------------------------------------------------------
DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid);
CREATE FUNCTION public.feed_posts(
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
  reply_to_username text, group_id uuid, group_name text, deleted boolean, orig_deleted boolean,
  university_id text, author_university_id text, author_department_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
         EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND l.user_id = uid),
         EXISTS (SELECT 1 FROM public.posts r WHERE r.repost_of = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND r.author_id = uid AND r.audio_path IS NULL),
         coalesce(p.author_id = uid, false),
         oa.username, oa.full_name, oa.avatar_path, o.title, o.audio_path, o.duration_ms, o.created_at, o.author_id,
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count,
         ra.username, p.group_id, g.name, p.deleted_at IS NOT NULL, coalesce(o.deleted_at IS NOT NULL, false),
         p.university_id, a.university_id, a.department_id
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
      WHEN 'foryou' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.audio_path IS NOT NULL
                         AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL
      WHEN 'following' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL
                            AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'news' THEN p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL
                       AND p.audio_path IS NOT NULL AND p.created_at > now() - interval '30 days'
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
END $$;

-- ---------------------------------------------------------------------------
-- 5. Topics: global ones stay global; campus topics + the campus topic of the day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.today()
RETURNS TABLE (moment date, prompt_at timestamptz, next_prompt_at timestamptz, topic_id uuid, topic_title text,
               topic_section text, topic_is_pick boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  m date := private.current_moment();
  t public.topics;
  pick boolean := true;
BEGIN
  SELECT * INTO t FROM public.topics WHERE daily_date = m AND university_id IS NULL AND NOT hidden;
  IF NOT FOUND THEN
    pick := false;
    SELECT tp.* INTO t FROM public.topics tp
    WHERE NOT tp.hidden AND tp.university_id IS NULL AND tp.created_at > now() - interval '48 hours'
    ORDER BY (SELECT count(*) FROM public.posts p WHERE p.topic_id = tp.id AND NOT p.hidden
              AND p.reply_to IS NULL AND p.created_at > now() - interval '24 hours') DESC,
             tp.pinned DESC, (tp.section_id = 'news') DESC, tp.created_at DESC
    LIMIT 1;
  END IF;
  RETURN QUERY SELECT m, private.prompt_at(m), private.prompt_at(m + 1), t.id, t.title, t.section_id, t.id IS NOT NULL AND pick;
END $$;

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
    WHERE p.topic_id IS NOT NULL AND p.group_id IS NULL AND p.university_id IS NULL AND p.reply_to IS NULL AND NOT p.hidden
      AND p.created_at > now() - interval '24 hours'
    GROUP BY p.topic_id
  )
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.created_at, t.posts_count,
         coalesce(r.n, 0)
  FROM public.topics t
  LEFT JOIN recent r ON r.topic_id = t.id
  WHERE NOT t.hidden AND t.university_id IS NULL AND (p_section IS NULL OR t.section_id = p_section)
    AND t.created_at > now() - interval '14 days'
  ORDER BY t.pinned DESC, coalesce(r.n, 0) * 10 + coalesce(r.engagement, 0) DESC, t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
END $$;

CREATE OR REPLACE FUNCTION public.news_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, image_url text,
               created_at timestamptz, last_post_at timestamptz, posts_count int, speakers_count int, speakers jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  daily uuid := CASE WHEN p_section IS NULL THEN (SELECT d.topic_id FROM public.today() d) END;
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
  WHERE NOT t.hidden AND t.university_id IS NULL AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.id = daily OR t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY coalesce(t.id = daily, false) DESC, t.pinned DESC,
           greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC, t.id
  LIMIT least(greatest(coalesce(p_limit, 15), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;

-- Your campus's topics: its topic of the day first (the admin's pick, else today's most talked-about campus topic),
-- then pinned, then latest activity. Same shape as news_topics + is_daily.
CREATE FUNCTION public.campus_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, image_url text,
               created_at timestamptz, last_post_at timestamptz, posts_count int, speakers_count int, speakers jsonb,
               is_daily boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  uni text := private.my_university();
  daily uuid;
BEGIN
  IF uni IS NULL THEN RETURN; END IF;
  SELECT t.id INTO daily FROM public.topics t
  WHERE t.university_id = uni AND t.daily_date = private.current_moment() AND NOT t.hidden;
  IF daily IS NULL THEN
    SELECT tp.id INTO daily FROM public.topics tp
    WHERE tp.university_id = uni AND NOT tp.hidden AND tp.kind <> 'news' AND tp.created_at > now() - interval '48 hours'
    ORDER BY (SELECT count(*) FROM public.posts p WHERE p.topic_id = tp.id AND NOT p.hidden AND p.reply_to IS NULL) DESC,
             tp.created_at DESC
    LIMIT 1;
  END IF;
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
           ) s), '[]'::jsonb),
         coalesce(t.id = daily, false)
  FROM public.topics t
  WHERE t.university_id = uni AND NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.id = daily OR t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY coalesce(t.id = daily, false) DESC, t.pinned DESC,
           greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC, t.id
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;

-- Admin: a topic (or topic of the day) for one campus.
DROP FUNCTION public.admin_create_topic(text, text, text, text, text, date);
CREATE FUNCTION public.admin_create_topic(p_section text, p_title text, p_summary text DEFAULT NULL,
  p_source_name text DEFAULT NULL, p_source_url text DEFAULT NULL, p_daily_date date DEFAULT NULL,
  p_university text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  tid uuid;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_university IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.universities WHERE id = p_university) THEN
    RAISE EXCEPTION 'bad_university' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sections s WHERE s.id = p_section
                 AND s.kind = CASE WHEN p_university IS NULL THEN 'news' ELSE 'campus' END) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.topics (section_id, kind, title, summary, source_name, source_url, daily_date, created_by, university_id)
  VALUES (p_section, CASE WHEN p_daily_date IS NULL THEN 'topic' ELSE 'daily' END, trim(p_title),
          nullif(trim(coalesce(p_summary, '')), ''), nullif(trim(coalesce(p_source_name, '')), ''),
          nullif(trim(coalesce(p_source_url, '')), ''), p_daily_date, uid, p_university)
  RETURNING id INTO tid;
  RETURN tid;
END $$;

DROP FUNCTION public.admin_topics(int);
CREATE FUNCTION public.admin_topics(p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, daily_date date,
               pinned boolean, hidden boolean, posts_count int, created_at timestamptz, university_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.daily_date, t.pinned, t.hidden,
         t.posts_count, t.created_at, t.university_id
  FROM public.topics t
  ORDER BY t.daily_date DESC NULLS LAST, t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

-- Profile counts: only the voices the viewer can hear.
CREATE OR REPLACE FUNCTION public.profile_stats(p_user uuid)
RETURNS TABLE (followers int, following int, posts int, i_follow boolean, follows_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF private.is_blocked(uid, p_user) THEN RETURN; END IF;
  RETURN QUERY SELECT
    (SELECT count(*)::int FROM public.follows WHERE followee_id = p_user),
    (SELECT count(*)::int FROM public.follows WHERE follower_id = p_user),
    (SELECT count(*)::int FROM public.posts WHERE author_id = p_user AND reply_to IS NULL AND group_id IS NULL AND NOT hidden
       AND (university_id IS NULL OR university_id = private.my_university())),
    private.follows(uid, p_user),
    private.follows(p_user, uid);
END $$;

-- ---------------------------------------------------------------------------
-- 6. University news by RSS → campus topics (NTUA: Νέα + Ανακοινώσεις, in "Ανακοινώσεις")
-- ---------------------------------------------------------------------------
ALTER TABLE private.news_feeds ADD COLUMN university_id text REFERENCES public.universities (id) ON DELETE CASCADE;
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'ΕΜΠ', 'https://www.ntua.gr/el/news?format=feed&type=rss', 'ntua'),
  ('announcements', 'ΕΜΠ · Ανακοινώσεις', 'https://www.ntua.gr/el/news/announcements?format=feed&type=rss', 'ntua');

CREATE OR REPLACE FUNCTION private.ingest_feed_xml(p_feed int, p_xml text, p_max int DEFAULT 2)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f private.news_feeds;
  doc xml;
  item xml;
  v_title text;
  v_link text;
  v_guid text;
  v_pub timestamptz;
  v_img text;
  v_ext text;
  added int := 0;
BEGIN
  SELECT * INTO f FROM private.news_feeds WHERE id = p_feed;
  IF NOT FOUND THEN RETURN 0; END IF;
  doc := xmlparse(document regexp_replace(p_xml, '^\s*<\?xml[^>]*\?>', ''));
  FOR item IN SELECT unnest(xpath('/rss/channel/item', doc)) LIMIT 30 LOOP
    v_title := left(private.clean_text((xpath('/item/title/text()', item))[1]::text), 160);
    v_link := trim(private.clean_text((xpath('/item/link/text()', item))[1]::text));
    v_guid := private.clean_text((xpath('/item/guid/text()', item))[1]::text);
    v_pub := private.try_timestamptz(private.clean_text((xpath('/item/pubDate/text()', item))[1]::text));
    CONTINUE WHEN v_title IS NULL OR char_length(v_title) < 3 OR v_link IS NULL OR v_link !~ '^https?://'
      OR char_length(v_link) > 1000 OR (v_pub IS NOT NULL AND v_pub < now() - interval '36 hours');
    v_img := private.item_image(item);
    v_ext := left(coalesce(v_guid, v_link), 500);
    -- a headline we already have gets its photo if it had none
    IF v_img IS NOT NULL THEN
      UPDATE public.topics SET image_url = v_img WHERE external_id = v_ext AND image_url IS NULL;
    END IF;
    INSERT INTO public.topics (section_id, kind, title, source_name, source_url, external_id, image_url, university_id)
    VALUES (f.section_id, 'news', v_title, f.name, v_link, v_ext, v_img, f.university_id)
    ON CONFLICT (external_id) DO NOTHING;
    IF FOUND THEN
      added := added + 1;
      EXIT WHEN added >= p_max;
    END IF;
  END LOOP;
  RETURN added;
END $$;

REVOKE EXECUTE ON FUNCTION private.ingest_feed_xml(int, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.my_university() TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
