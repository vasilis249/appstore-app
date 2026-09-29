-- Speak S4: automatic news topics from Greek RSS feeds, admin topic tools, and the daily topic.
-- Feeds are fetched inside the database (pg_net) every 3 hours and parsed with xpath; only the
-- headline and the link are stored (no article text). At most 2 new headlines per feed per run.

-- ---------------------------------------------------------------------------
-- 1. Feeds
-- ---------------------------------------------------------------------------
CREATE TABLE private.news_feeds (
  id serial PRIMARY KEY,
  section_id text NOT NULL REFERENCES public.sections (id),
  name text NOT NULL,
  url text NOT NULL UNIQUE CHECK (url ~ '^https://'),
  enabled boolean NOT NULL DEFAULT true,
  last_request_id bigint,
  last_fetched_at timestamptz,
  last_ingested_at timestamptz,
  last_added int,
  last_error text
);
ALTER TABLE private.news_feeds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.news_feeds FROM PUBLIC, anon, authenticated;

INSERT INTO private.news_feeds (section_id, name, url) VALUES
  ('news', 'ΕΡΤ News', 'https://www.ertnews.gr/feed/'),
  ('news', 'Καθημερινή', 'https://www.kathimerini.gr/infeeds/rss/nx-rss-feed.xml'),
  ('tech', 'Techblog', 'https://www.techblog.gr/feed/'),
  ('sports', 'Gazzetta', 'https://www.gazzetta.gr/rss'),
  ('economy', 'Ναυτεμπορική', 'https://www.naftemporiki.gr/finance/feed/'),
  ('politics', 'Ναυτεμπορική', 'https://www.naftemporiki.gr/politics/feed/'),
  ('entertainment', 'Cinemagazine', 'https://www.cinemagazine.gr/feed/'),
  ('lifestyle', 'LiFO', 'https://www.lifo.gr/rss.xml');

-- ---------------------------------------------------------------------------
-- 2. Parsing
-- ---------------------------------------------------------------------------
-- Plain text from an RSS field: CDATA unwrapped (xpath keeps it), no tags, common entities decoded,
-- whitespace collapsed.
CREATE FUNCTION private.clean_text(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(trim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      regexp_replace(regexp_replace(coalesce(t, ''), '<!\[CDATA\[(.*?)\]\]>', '\1', 'g'), '<[^>]*>', ' ', 'g'),
      '&amp;', '&'), '&quot;', '"'), '&#039;', ''''), '&#39;', ''''), '&apos;', ''''),
      '&nbsp;', ' '), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&lt;', '<'),
    '\s+', ' ', 'g')), '')
$$;

CREATE FUNCTION private.try_timestamptz(t text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN t::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- Add up to p_max fresh headlines (≤ 36 h old) from one RSS document as news topics.
CREATE FUNCTION private.ingest_feed_xml(p_feed int, p_xml text, p_max int DEFAULT 2)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f private.news_feeds;
  doc xml;
  item xml;
  v_title text;
  v_link text;
  v_guid text;
  v_pub timestamptz;
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
    INSERT INTO public.topics (section_id, kind, title, source_name, source_url, external_id)
    VALUES (f.section_id, 'news', v_title, f.name, v_link, left(coalesce(v_guid, v_link), 500))
    ON CONFLICT (external_id) DO NOTHING;
    IF FOUND THEN
      added := added + 1;
      EXIT WHEN added >= p_max;
    END IF;
  END LOOP;
  RETURN added;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Fetching (pg_net, hosted only) and ingesting the responses
-- ---------------------------------------------------------------------------
CREATE FUNCTION private.fetch_news()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f record;
BEGIN
  FOR f IN SELECT id, url FROM private.news_feeds WHERE enabled LOOP
    UPDATE private.news_feeds
    SET last_request_id = net.http_get(
          url := f.url,
          headers := jsonb_build_object('User-Agent', 'SpeakBot/1.0 (headlines only; +https://courtsie.vasilis-har.workers.dev)'),
          timeout_milliseconds := 20000),
        last_fetched_at = now()
    WHERE id = f.id;
  END LOOP;
END $$;

CREATE FUNCTION private.ingest_news()
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
  RETURN total;
END $$;

REVOKE EXECUTE ON FUNCTION private.ingest_feed_xml(int, text, int), private.fetch_news(), private.ingest_news()
  FROM PUBLIC, authenticated;

DO $net$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  ELSE
    RAISE NOTICE 'pg_net not available: news are not fetched here';
  END IF;
EXCEPTION WHEN insufficient_privilege OR feature_not_supported OR undefined_file THEN
  RAISE NOTICE 'pg_net not set up: %', SQLERRM;
END
$net$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule('fetch-news', '17 */3 * * *', 'SELECT private.fetch_news()');
    PERFORM cron.schedule('ingest-news', '22 */3 * * *', 'SELECT private.ingest_news()');
  ELSE
    RAISE NOTICE 'news jobs not scheduled (pg_cron / pg_net missing)';
  END IF;
END
$cron$;

-- ---------------------------------------------------------------------------
-- 4. The daily topic: the admin's pick, otherwise today's most discussed fresh topic
-- ---------------------------------------------------------------------------
DROP FUNCTION public.today();
CREATE FUNCTION public.today()
RETURNS TABLE (moment date, prompt_at timestamptz, next_prompt_at timestamptz, topic_id uuid, topic_title text,
               topic_section text, topic_is_pick boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  m date := private.current_moment();
  t public.topics;
  pick boolean := true;
BEGIN
  SELECT * INTO t FROM public.topics WHERE daily_date = m AND NOT hidden;
  IF NOT FOUND THEN
    pick := false;
    SELECT tp.* INTO t FROM public.topics tp
    WHERE NOT tp.hidden AND tp.created_at > now() - interval '48 hours'
    ORDER BY (SELECT count(*) FROM public.posts p WHERE p.topic_id = tp.id AND NOT p.hidden
              AND p.reply_to IS NULL AND p.created_at > now() - interval '24 hours') DESC,
             tp.pinned DESC, (tp.section_id = 'news') DESC, tp.created_at DESC
    LIMIT 1;
  END IF;
  RETURN QUERY SELECT m, private.prompt_at(m), private.prompt_at(m + 1), t.id, t.title, t.section_id, t.id IS NOT NULL AND pick;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Admin tools
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.admin_topics(p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, daily_date date,
               pinned boolean, hidden boolean, posts_count int, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.daily_date, t.pinned, t.hidden,
         t.posts_count, t.created_at
  FROM public.topics t
  ORDER BY t.daily_date DESC NULLS LAST, t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

CREATE FUNCTION public.admin_feeds()
RETURNS TABLE (id int, section_id text, name text, url text, enabled boolean, last_fetched_at timestamptz,
               last_added int, last_error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT f.id, f.section_id, f.name, f.url, f.enabled, f.last_fetched_at, f.last_added, f.last_error
  FROM private.news_feeds f ORDER BY f.id;
END $$;

CREATE FUNCTION public.admin_set_feed(p_feed int, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE private.news_feeds SET enabled = p_enabled WHERE id = p_feed;
END $$;

-- Ingest what the last fetch brought, then fetch again (results arrive a few seconds later).
CREATE FUNCTION public.admin_refresh_news()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  n int;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  PERFORM private.rate_limit('refresh_news', 20, interval '1 hour');
  n := private.ingest_news();
  PERFORM private.fetch_news();
  RETURN n;
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
