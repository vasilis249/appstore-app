-- Daily Trojan (USC's student newspaper), user request 2026-10-03 → USC campus, section Φοιτητική ζωή. Its URLs carry
-- no section (/yyyy/mm/dd/slug), so the one rule is on the title: the daily "Classifieds" lists are left out.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('campuslife', 'Daily Trojan', 'https://dailytrojan.com/feed/', 'usc')
ON CONFLICT (url) DO NOTHING;

INSERT INTO private.news_routes (feed_id, position, pattern, section_id, on_title)
SELECT id, 1, '^classifieds', NULL, true FROM private.news_feeds WHERE url = 'https://dailytrojan.com/feed/'
ON CONFLICT DO NOTHING;
