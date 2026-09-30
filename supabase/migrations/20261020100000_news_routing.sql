-- Stricter news sections. Several feeds are broader than the section they were filed under: ΕΡΤ and Καθημερινή
-- (Επικαιρότητα) carry sports, economy, culture…; Gazzetta (Αθλητικά) carries lifestyle and ads under /plus and
-- /gmotion; LiFO (Lifestyle) is mostly world and Greek news. Each headline is now routed by the section path in its
-- URL: a rule per feed sends it to the right section or drops it (opinion columns, name days, advertorials…).
-- Feeds marked `drop_unmatched` drop what no rule matches; the others keep their own section for it.

ALTER TABLE private.news_feeds ADD COLUMN drop_unmatched boolean NOT NULL DEFAULT false;

CREATE TABLE private.news_routes (
  id serial PRIMARY KEY,
  feed_id int NOT NULL REFERENCES private.news_feeds (id) ON DELETE CASCADE,
  position int NOT NULL,
  pattern text NOT NULL,                      -- regex on the URL path (after the host), e.g. '^/athlitismos/'
  section_id text REFERENCES public.sections (id),  -- NULL = drop the headline
  UNIQUE (feed_id, position)
);
ALTER TABLE private.news_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.news_routes FROM PUBLIC, anon, authenticated;

-- The section for a headline of this feed, or NULL to leave it out.
CREATE FUNCTION private.route_news(p_feed int, p_url text)
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

-- Rules (checked in order; first match wins).
CREATE FUNCTION pg_temp.routes(p_url text, p_strict boolean, p_rules text[][])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE fid int; i int;
BEGIN
  SELECT id INTO fid FROM private.news_feeds WHERE url = p_url;
  IF fid IS NULL THEN RETURN; END IF;
  UPDATE private.news_feeds SET drop_unmatched = p_strict WHERE id = fid;
  DELETE FROM private.news_routes WHERE feed_id = fid;
  FOR i IN 1 .. array_length(p_rules, 1) LOOP
    INSERT INTO private.news_routes (feed_id, position, pattern, section_id)
    VALUES (fid, i, p_rules[i][1], nullif(p_rules[i][2], ''));
  END LOOP;
END $$;

-- ΕΡΤ News → Επικαιρότητα, except its sports / economy / politics / culture / science desks.
SELECT pg_temp.routes('https://www.ertnews.gr/feed/', false, ARRAY[
  ['^/athlitismos(/|$)', 'sports'],
  ['^/eidiseis/oikonomia(/|$)', 'economy'],
  ['^/eidiseis/politiki(/|$)', 'politics'],
  ['^/eidiseis/politismos(/|$)', 'entertainment'],
  ['^/eidiseis/(epistimi|texnologia|tehnologia)(/|$)', 'tech'],
  ['^/(eidiseis|ert3|roi-idiseon|perifereiakoi-stathmoi)(/|$)', 'news']]);

-- Καθημερινή: every desk to its section; opinion, columns, name days, history, visuals left out.
SELECT pg_temp.routes('https://www.kathimerini.gr/infeeds/rss/nx-rss-feed.xml', true, ARRAY[
  ['^/(athletics|sports)(/|$)', 'sports'],
  ['^/economy(/|$)', 'economy'],
  ['^/politics(/|$)', 'politics'],
  ['^/culture(/|$)', 'entertainment'],
  ['^/(life|k)(/|$)', 'lifestyle'],
  ['^/(world|society|greece|news)(/|$)', 'news'],
  ['^/(opinion|columns|eortologio|istoria|visual)(/|$)', '']]);

-- Gazzetta: only sport; /plus (lifestyle, sponsored) and /gmotion (cars) out, except motor racing there.
SELECT pg_temp.routes('https://www.gazzetta.gr/rss', true, ARRAY[
  ['^/(football|basketball|tennis|volleyball|handball|polo|athletics|stivos|motorsport|formula-?1|other-sports|esports)(/|$)', 'sports'],
  ['^/gmotion/([a-z-]+/)?[0-9]+/(f1|formula|motogp|rally|wrc|grand-prix)', 'sports']]);

-- LiFO: its news desks go to their sections; guides, living, viral stay in Lifestyle; /agora (advertorials) out.
SELECT pg_temp.routes('https://www.lifo.gr/rss.xml', false, ARRAY[
  ['^/agora(/|$)', ''],
  ['^/now/(world|greece)(/|$)', 'news'],
  ['^/now/politics(/|$)', 'politics'],
  ['^/now/economy(/|$)', 'economy'],
  ['^/now/tech-science(/|$)', 'tech'],
  ['^/now/sport', 'sports'],
  ['^/now/entertainment(/|$)', 'entertainment'],
  ['^/(guide|thegoodlifo|lifoland|culture|travel|blogs|articles)(/|$)', 'lifestyle']]);

-- Techblog, Ναυτεμπορική (finance / politics) and Cinemagazine are single-subject: no rules needed.

-- Ingest: the headline goes to its routed section (or is skipped).
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
    v_section := private.route_news(p_feed, v_link);
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
REVOKE EXECUTE ON FUNCTION private.ingest_feed_xml(int, text, int), private.route_news(int, text) FROM PUBLIC, anon, authenticated;

-- The headlines already in (last 7 days, nobody has spoken on them yet): move to the right section or remove.
DO $$
DECLARE t record; fid int; sec text;
BEGIN
  FOR t IN
    SELECT tp.id, tp.section_id, tp.source_name, tp.source_url FROM public.topics tp
    WHERE tp.kind = 'news' AND tp.university_id IS NULL AND tp.posts_count = 0 AND NOT tp.pinned
      AND tp.created_at > now() - interval '7 days'
  LOOP
    SELECT f.id INTO fid FROM private.news_feeds f
    WHERE f.university_id IS NULL AND f.name = t.source_name
    ORDER BY (f.section_id = t.section_id) DESC, f.id LIMIT 1;
    CONTINUE WHEN fid IS NULL;
    sec := private.route_news(fid, t.source_url);
    IF sec IS NULL THEN
      DELETE FROM public.topics WHERE id = t.id;
    ELSIF sec <> t.section_id THEN
      UPDATE public.topics SET section_id = sec WHERE id = t.id;
    END IF;
  END LOOP;
END $$;
