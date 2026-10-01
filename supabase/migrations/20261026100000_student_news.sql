-- student-news (SPEC.md): News is only for students — your university's announcements + student topics.
--  1. The 8 general sections (Επικαιρότητα, Tech, Αθλητικά …) are hidden, not deleted, and their RSS feeds switched
--     off. Their topics go; their voices become personal voices of their authors (profile + Following), so nothing
--     anyone said is lost. Group voices keep their group's section. Nobody can post into a hidden section.
--  2. Four student news sections: Πανεπιστήμια, Παροχές (στέγαση, σίτιση, υποτροφίες), Erasmus, Καριέρα.
--  3. Student-topic sources (education sites, checked on their real feeds 2026-10-01: esos.gr, alfavita.gr,
--     neolaia.gr) routed by keywords on the TITLE: school / teacher news is dropped, the rest goes to the first
--     student section that matches, anything else is left out (drop_unmatched).
--  4. Campus RSS for 15 more institutions (their own feeds, checked the same day) → their campus's Ανακοινώσεις.
--  5. news_topics (News tab, "Όλα") also lists your own university's announcements.

-- ---------------------------------------------------------------------------
-- 1–2. Sections
-- ---------------------------------------------------------------------------
ALTER TABLE public.sections ADD COLUMN hidden boolean NOT NULL DEFAULT false;
UPDATE public.sections SET hidden = true
WHERE id IN ('news', 'tech', 'sports', 'economy', 'politics', 'entertainment', 'lifestyle', 'humor');
INSERT INTO public.sections (id, position, name_el, name_en, icon, kind) VALUES
  ('unis', 11, 'Πανεπιστήμια', 'Universities', 'graduation-cap', 'news'),
  ('benefits', 12, 'Παροχές', 'Benefits', 'wallet', 'news'),
  ('abroad', 13, 'Erasmus', 'Erasmus', 'plane', 'news'),
  ('career', 14, 'Καριέρα', 'Career', 'briefcase', 'news')
ON CONFLICT (id) DO NOTHING;

UPDATE public.posts p SET section_id = NULL, topic_id = NULL
FROM public.sections s
WHERE s.id = p.section_id AND s.hidden AND p.group_id IS NULL AND p.university_id IS NULL;
UPDATE public.posts p SET topic_id = NULL
WHERE p.topic_id IN (SELECT t.id FROM public.topics t JOIN public.sections s ON s.id = t.section_id WHERE s.hidden);
DELETE FROM public.topics t USING public.sections s WHERE s.id = t.section_id AND s.hidden;

CREATE FUNCTION private.posts_section_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.group_id IS NULL AND EXISTS (SELECT 1 FROM public.sections WHERE id = NEW.section_id AND hidden) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_section_open BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.posts_section_open();

-- ---------------------------------------------------------------------------
-- 3. Title routing + student-topic sources
-- ---------------------------------------------------------------------------
UPDATE private.news_feeds SET enabled = false WHERE university_id IS NULL;

ALTER TABLE private.news_routes ADD COLUMN on_title boolean NOT NULL DEFAULT false; -- pattern on the folded title

-- lower case, no Greek accents / diaeresis, final sigma as σ: "Φοιτητικές Εστίες" → "φοιτητικεσ εστιεσ"
CREATE FUNCTION private.fold_el(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT translate(lower(coalesce(p, '')), 'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ')
$$;

-- a section that may still get headlines (an admin re-enabling an old general feed adds nothing to hidden ones)
CREATE FUNCTION private.open_section(p_section text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.sections WHERE id = p_section AND NOT hidden
$$;

CREATE OR REPLACE FUNCTION private.route_headline(p_feed int, p_url text, p_title text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f private.news_feeds;
  path text := lower(coalesce(substring(p_url FROM '^https?://[^/?#]+([^?#]*)'), ''));
  title text := private.fold_el(p_title);
  r private.news_routes;
BEGIN
  SELECT * INTO f FROM private.news_feeds WHERE id = p_feed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF f.university_id IS NULL AND private.news_is_sponsored(p_title) THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM private.news_routes WHERE feed_id = p_feed ORDER BY position LOOP
    IF (CASE WHEN r.on_title THEN title ELSE path END) ~ r.pattern THEN RETURN private.open_section(r.section_id); END IF;
  END LOOP;
  RETURN CASE WHEN f.drop_unmatched THEN NULL ELSE private.open_section(f.section_id) END;
END $$;
REVOKE EXECUTE ON FUNCTION private.route_headline(int, text, text), private.fold_el(text), private.open_section(text) FROM PUBLIC, anon, authenticated;

INSERT INTO private.news_feeds (section_id, name, url, drop_unmatched) VALUES
  ('unis', 'esos', 'https://www.esos.gr/rss.xml', true),
  ('unis', 'Αλφαβήτα', 'https://www.alfavita.gr/rss.xml', true),
  ('unis', 'Νεολαία', 'https://www.neolaia.gr/feed/', true)
ON CONFLICT (url) DO NOTHING;

-- Same rules for the three; order matters (first match wins, NULL = leave out). Patterns run on fold_el(title).
INSERT INTO private.news_routes (feed_id, position, pattern, section_id, on_title)
SELECT f.id, r.position, r.pattern, r.section_id, true
FROM private.news_feeds f
CROSS JOIN (VALUES
  -- school, pupils, teachers' careers: not student news
  (1, 'μαθητ|σχολει|νηπιαγωγ|δασκαλ|αναπληρωτ|εκπαιδευτικ(οσ|οι|ου|ων)|γυμνασι|λυκει|(^|[^α-ω])επαλ([^α-ω]|$)|ε\.π\.α\.λ|διορισ|αποσπασ|πανελλαδικ|φροντιστηρ|ξενων γλωσσων', NULL),
  (2, 'εστι(α|εσ|ων)([^α-ω]|$)|σιτιση|στεγαστικ|επιδομα|υποτροφ|ακαδημαικ\S* ταυτοτητ|φοιτητικ\S* (κατοικ|σπιτ|στεγ)', 'benefits'),
  (3, 'erasmus|στο εξωτερικο|δοατ|study abroad', 'abroad'),
  (4, 'πρακτικ\S* ασκησ|internship|καριερ|career|θεσεισ εργασιασ|αποφοιτ', 'career'),
  (5, 'πανεπιστημ|φοιτητ|(^|[^α-ω])αει([^α-ω]|$)|α\.ε\.ι|πολυτεχνει|μεταπτυχιακ|διδακτορ|πτυχι|ακαδημαικ|μετεγγραφ|κατατακτηρι|πρυταν|(^|[^α-ω])(δεπ|εκπα|απθ|εμπ|οπα|παπει|παδα|δπθ|διπαε|ελμεπα|εαπ|παν\.)([^α-ω]|$)', 'unis')
) AS r (position, pattern, section_id)
WHERE f.url IN ('https://www.esos.gr/rss.xml', 'https://www.alfavita.gr/rss.xml', 'https://www.neolaia.gr/feed/')
ON CONFLICT (feed_id, position) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Campus feeds for the new institutions (University of the Aegean's is quiet since 2025: kept, ingest only
--    takes items ≤ 36 h old). None found for ΠΑΜΑΚ, Θεσσαλία, Ιωάννινα, Πολ. Κρήτης, Ιόνιο, UCY, ΤΕΠΑΚ, UNIC,
--    Frederick, Νεάπολις, CITY, Metropolitan, BCA, Mediterranean, ACT, HAU; ΑΠΚΥ's answers "service not available".
-- ---------------------------------------------------------------------------
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'ΑΠΘ', 'https://www.auth.gr/feed/', 'auth'),
  ('announcements', 'ΕΛΜΕΠΑ', 'https://www.hmu.gr/feed/', 'hmu'),
  ('announcements', 'Π. Πατρών', 'https://www.upatras.gr/feed/', 'upatras'),
  ('announcements', 'Π. Κρήτης', 'https://www.uoc.gr/feed/', 'uoc'),
  ('announcements', 'ΔΠΘ', 'https://www.duth.gr/feed/', 'duth'),
  ('announcements', 'ΔΙΠΑΕ', 'https://www.ihu.gr/feed/', 'ihu'),
  ('announcements', 'ΠΔΜ', 'https://www.uowm.gr/feed/', 'uowm'),
  ('announcements', 'Π. Πελοποννήσου', 'https://www.uop.gr/rss.xml', 'uop'),
  ('announcements', 'Π. Αιγαίου', 'https://www.aegean.gr/rss.xml', 'aegean'),
  ('announcements', 'ΕΑΠ', 'https://www.eap.gr/feed/', 'eap'),
  ('announcements', 'EUC', 'https://www.euc.ac.cy/feed/', 'euc'),
  ('announcements', 'UCLan Cyprus', 'https://www.uclancyprus.ac.cy/feed/', 'uclancy'),
  ('announcements', 'NYC', 'https://www.nyc.gr/feed/', 'nyc'),
  ('announcements', 'IST', 'https://www.ist.edu.gr/feed/', 'ist'),
  ('announcements', 'Perrotis', 'https://www.perrotiscollege.edu.gr/feed/', 'perrotis')
ON CONFLICT (url) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. News tab: student headlines + (on "Όλα") your university's announcements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, image_url text,
               created_at timestamptz, last_post_at timestamptz, posts_count int, speakers_count int, speakers jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  uni text := private.my_university();
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
  WHERE NOT t.hidden
    AND (t.university_id IS NULL OR (p_section IS NULL AND t.kind = 'news' AND t.university_id = uni))
    AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.id = daily OR t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY coalesce(t.id = daily, false) DESC, t.pinned DESC,
           greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC, t.id
  LIMIT least(greatest(coalesce(p_limit, 15), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;
