-- Speak: News as cards. A headline with its cover photo, then who spoke about it; tap → the voices one by one.
--  • topics.image_url: taken from the RSS item (media:content / enclosure / media:thumbnail / <img> in the text),
--    else from the article page's og:image (fetched once, a few minutes after the headline arrives). The image is
--    shown from the publisher's server, never copied.
--  • news_topics(section, limit, offset): recent headlines with photo, voices and the first few speakers.
--  • feed_posts scope 'loose': voices filed in a section but not about a headline ("Other voices").

ALTER TABLE public.topics ADD COLUMN image_url text
  CHECK (image_url IS NULL OR (image_url ~ '^https://' AND char_length(image_url) <= 1000));

-- ---------------------------------------------------------------------------
-- 1. Images from the feed
-- ---------------------------------------------------------------------------
CREATE FUNCTION private.clean_image_url(u text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN v ~ '^https://[^\s"<>]+$' AND char_length(v) <= 1000 THEN v END
  FROM (SELECT replace(replace(btrim(coalesce(u, '')), '&amp;', '&'), '&#038;', '&') AS v) x
$$;

CREATE FUNCTION private.item_image(item xml)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  raw text := item::text;
  u text;
BEGIN
  u := private.clean_image_url((xpath('/item/*[local-name()=''content''][not(@medium) or @medium=''image''][@url]/@url', item))[1]::text);
  IF u IS NULL THEN
    u := private.clean_image_url((xpath('/item/enclosure[starts-with(@type, ''image'')]/@url', item))[1]::text);
  END IF;
  IF u IS NULL THEN
    u := private.clean_image_url((xpath('/item/*[local-name()=''thumbnail'']/@url', item))[1]::text);
  END IF;
  IF u IS NULL THEN  -- <img src="…"> inside the description / content (escaped or CDATA)
    u := private.clean_image_url(substring(raw FROM '(?:&lt;|<)img[^>]*?src=(?:"|&quot;)(https://[^"&]+(?:&amp;[^"&]+)*)'));
  END IF;
  RETURN u;
END $$;

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
    INSERT INTO public.topics (section_id, kind, title, source_name, source_url, external_id, image_url)
    VALUES (f.section_id, 'news', v_title, f.name, v_link, v_ext, v_img)
    ON CONFLICT (external_id) DO NOTHING;
    IF FOUND THEN
      added := added + 1;
      EXIT WHEN added >= p_max;
    END IF;
  END LOOP;
  RETURN added;
END $$;

-- ---------------------------------------------------------------------------
-- 2. og:image for headlines without a photo (and admin topics with a source link)
-- ---------------------------------------------------------------------------
CREATE TABLE private.topic_image_fetches (
  topic_id uuid PRIMARY KEY REFERENCES public.topics (id) ON DELETE CASCADE,
  request_id bigint,
  tried_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.topic_image_fetches ENABLE ROW LEVEL SECURITY;

-- <meta property="og:image" content="…"> in either attribute order.
CREATE FUNCTION private.og_image(html text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.clean_image_url(coalesce(
    substring(html FROM '<meta[^>]+property=["'']og:image(?::secure_url|:url)?["''][^>]*content=["'']([^"'']+)'),
    substring(html FROM '<meta[^>]+content=["'']([^"'']+)["''][^>]*property=["'']og:image(?::secure_url|:url)?["'']'),
    substring(html FROM '<meta[^>]+name=["'']twitter:image["''][^>]*content=["'']([^"'']+)')))
$$;

CREATE FUNCTION private.fetch_topic_images()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t record;
BEGIN
  DELETE FROM private.topic_image_fetches WHERE tried_at < now() - interval '7 days';
  FOR t IN
    SELECT tp.id, tp.source_url FROM public.topics tp
    WHERE tp.image_url IS NULL AND tp.source_url ~ '^https://' AND NOT tp.hidden AND tp.created_at > now() - interval '3 days'
      AND NOT EXISTS (SELECT 1 FROM private.topic_image_fetches x WHERE x.topic_id = tp.id)
    ORDER BY tp.created_at DESC LIMIT 20
  LOOP
    INSERT INTO private.topic_image_fetches (topic_id, request_id)
    VALUES (t.id, net.http_get(
      url := t.source_url,
      headers := jsonb_build_object('User-Agent', 'SpeakBot/1.0 (link preview; +https://courtsie.vasilis-har.workers.dev)'),
      timeout_milliseconds := 15000));
  END LOOP;
END $$;

CREATE FUNCTION private.ingest_topic_images()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  x record;
  img text;
  n int := 0;
BEGIN
  FOR x IN
    SELECT f.topic_id, r.status_code, r.content FROM private.topic_image_fetches f
    JOIN net._http_response r ON r.id = f.request_id
  LOOP
    img := CASE WHEN x.status_code = 200 THEN private.og_image(left(x.content, 300000)) END;
    IF img IS NOT NULL THEN
      UPDATE public.topics SET image_url = img WHERE id = x.topic_id AND image_url IS NULL;
      n := n + 1;
    END IF;
    UPDATE private.topic_image_fetches SET request_id = NULL WHERE topic_id = x.topic_id;
  END LOOP;
  RETURN n;
END $$;

-- ingest_news also asks for the missing photos (answers are read by the 'news-images' job 5 minutes later).
CREATE OR REPLACE FUNCTION private.ingest_news()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f record;
  r record;
  n int;
  total int := 0;
BEGIN
  FOR f IN SELECT id, last_request_id FROM private.news_feeds WHERE last_request_id IS NOT NULL LOOP
    SELECT status_code, content, error_msg INTO r FROM net._http_response WHERE id = f.last_request_id;
    CONTINUE WHEN NOT FOUND;  -- still in flight
    BEGIN
      IF r.status_code = 200 THEN
        n := private.ingest_feed_xml(f.id, r.content);
        UPDATE private.news_feeds SET last_added = n, last_error = NULL WHERE id = f.id;
        total := total + n;
      ELSE
        UPDATE private.news_feeds SET last_added = 0, last_error = coalesce(r.error_msg, 'HTTP ' || r.status_code) WHERE id = f.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE private.news_feeds SET last_added = 0, last_error = left(SQLERRM, 300) WHERE id = f.id;
    END;
    UPDATE private.news_feeds SET last_request_id = NULL, last_ingested_at = now() WHERE id = f.id;
  END LOOP;
  -- Old headlines nobody talked about go away after a week.
  DELETE FROM public.topics WHERE kind = 'news' AND posts_count = 0 AND created_at < now() - interval '7 days';
  BEGIN
    PERFORM private.fetch_topic_images();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'topic images: %', SQLERRM;
  END;
  RETURN total;
END $$;

REVOKE EXECUTE ON FUNCTION private.item_image(xml), private.og_image(text), private.clean_image_url(text),
  private.fetch_topic_images(), private.ingest_topic_images() FROM PUBLIC, authenticated;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule('news-images', '27 */3 * * *', 'SELECT private.ingest_topic_images()');
  ELSE
    RAISE NOTICE 'news-images job not scheduled (pg_cron / pg_net missing)';
  END IF;
END
$cron$;

-- ---------------------------------------------------------------------------
-- 3. Headlines as cards
-- ---------------------------------------------------------------------------
-- Recent headlines (7 days, or talked about in the last 3), pinned first, then the most recently active.
-- speakers = up to 3 people who spoke (name + avatar), people you've blocked left out.
CREATE FUNCTION public.news_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0)
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
           SELECT jsonb_agg(jsonb_build_object('name', s.full_name, 'avatar_path', s.avatar_path) ORDER BY s.last DESC)
           FROM (
             SELECT a.full_name, a.avatar_path, max(p.created_at) AS last
             FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
             WHERE p.topic_id = t.id AND p.reply_to IS NULL AND NOT p.hidden AND NOT a.disabled
               AND NOT private.is_blocked(uid, a.id)
             GROUP BY a.id, a.full_name, a.avatar_path
             ORDER BY last DESC LIMIT 3
           ) s), '[]'::jsonb)
  FROM public.topics t
  WHERE NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY t.pinned DESC, greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC
  LIMIT least(greatest(coalesce(p_limit, 15), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
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

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
