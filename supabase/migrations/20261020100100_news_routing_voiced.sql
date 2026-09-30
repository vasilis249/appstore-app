-- Follow-up to the news routing (seen on the phone):
--  1. Headlines people had already spoken about were left where they were: move them too, with their voices
--     (the voices' section follows the headline). A headline routing would drop moves to a neutral section instead:
--     Gazzetta's /plus → Lifestyle, anything else → Επικαιρότητα.
--  2. Sponsored posts slip in under sport paths (e.g. "ΚΑΕ Πανιώνιος x Novibet"): headlines naming a betting
--     brand or sponsorship are left out of every news feed (campus feeds untouched).

CREATE FUNCTION private.news_is_sponsored(p_title text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_title, '') ~* ('(novibet|bwin|stoiximan|pame ?stoixima|interwetten|betsson|sportingbet|bet365|netbet|'
    || 'elabet|winmasters|fonbet|vistabet|meridianbet|\mopap\M|οπαπ|powered by|sponsored|χορηγούμενο|in association with)')
$$;

CREATE OR REPLACE FUNCTION private.route_news(p_feed int, p_url text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f private.news_feeds;
  path text := lower(coalesce(substring(p_url FROM '^https?://[^/?#]+([^?#]*)'), ''));
  r private.news_routes;
BEGIN
  SELECT * INTO f FROM private.news_feeds WHERE id = p_feed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM private.news_routes WHERE feed_id = p_feed ORDER BY position LOOP
    IF path ~ r.pattern THEN RETURN r.section_id; END IF;
  END LOOP;
  RETURN CASE WHEN f.drop_unmatched THEN NULL ELSE f.section_id END;
END $$;

-- The section for a headline (title + link) of this feed, or NULL to leave it out.
CREATE FUNCTION private.route_headline(p_feed int, p_url text, p_title text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN (SELECT university_id IS NULL FROM private.news_feeds WHERE id = p_feed) AND private.news_is_sponsored(p_title) THEN NULL
    ELSE private.route_news(p_feed, p_url) END
$$;

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
  v_section text;
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
    v_section := private.route_headline(p_feed, v_link, v_title);
    CONTINUE WHEN v_section IS NULL;
    v_img := private.item_image(item);
    v_ext := left(coalesce(v_guid, v_link), 500);
    -- a headline we already have gets its photo if it had none
    IF v_img IS NOT NULL THEN
      UPDATE public.topics SET image_url = v_img WHERE external_id = v_ext AND image_url IS NULL;
    END IF;
    INSERT INTO public.topics (section_id, kind, title, source_name, source_url, external_id, image_url, university_id)
    VALUES (v_section, 'news', v_title, f.name, v_link, v_ext, v_img, f.university_id)
    ON CONFLICT (external_id) DO NOTHING;
    IF FOUND THEN
      added := added + 1;
      EXIT WHEN added >= p_max;
    END IF;
  END LOOP;
  RETURN added;
END $$;
REVOKE EXECUTE ON FUNCTION private.ingest_feed_xml(int, text, int), private.route_news(int, text),
  private.route_headline(int, text, text), private.news_is_sponsored(text) FROM PUBLIC, anon, authenticated;

-- Re-file the last 8 days: silent headlines move or go; headlines with voices move (never go), voices with them.
DO $$
DECLARE t record; fid int; fpath text; sec text;
BEGIN
  FOR t IN
    SELECT tp.id, tp.section_id, tp.source_name, tp.source_url, tp.title, tp.posts_count FROM public.topics tp
    WHERE tp.kind = 'news' AND tp.university_id IS NULL AND NOT tp.pinned AND tp.created_at > now() - interval '8 days'
  LOOP
    SELECT f.id, f.url INTO fid, fpath FROM private.news_feeds f
    WHERE f.university_id IS NULL AND f.name = t.source_name
    ORDER BY (f.section_id = t.section_id) DESC, f.id LIMIT 1;
    CONTINUE WHEN fid IS NULL;
    sec := private.route_headline(fid, t.source_url, t.title);
    IF sec IS NULL AND t.posts_count = 0 THEN
      DELETE FROM public.topics WHERE id = t.id;
      CONTINUE;
    END IF;
    IF sec IS NULL THEN
      sec := CASE WHEN fpath LIKE '%gazzetta.gr%' THEN 'lifestyle' ELSE 'news' END;
    END IF;
    IF sec <> t.section_id THEN
      UPDATE public.topics SET section_id = sec WHERE id = t.id;
      UPDATE public.posts SET section_id = sec WHERE topic_id = t.id AND section_id IS NOT NULL;
    END IF;
  END LOOP;
END $$;
