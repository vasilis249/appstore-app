-- Campus news for CH / DE / AT / NL / BE (user request 2026-10-11): independent student / university magazines →
-- Φοιτητική ζωή (English edition where there is one), official news → Ανακοινώσεις. Checked 2026-10-11 with
-- supabase/data/check_feeds.py (final URLs, SpeakBot UA). None found for most German / Swiss / Austrian universities
-- (no RSS any more or blocked), Leiden (Mare), Erasmus Magazine, Cursor (TU/e), Observant, Veto (KU Leuven), Univers
-- and prisma (inactive), Luxembourg.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('campuslife', 'Polykum', 'https://www.polykum.ethz.ch/feed/', 'ethz'),
  ('announcements', 'EPFL News', 'https://actu.epfl.ch/feeds/rss/mediacom/en/', 'epfl'),
  ('announcements', 'UNIGE Actualités', 'https://www.unige.ch/actualites/rss', 'unige'),
  ('announcements', 'FU Berlin News', 'https://www.fu-berlin.de/en/newsuebersicht/index.rss?format=rss', 'fuberlin'),
  ('announcements', 'University of Bonn News', 'https://www.uni-bonn.de/en/news/rss.xml', 'bonn'),
  ('announcements', 'Charité Pressemitteilungen', 'https://www.charite.de/service/pressemitteilung/feed/pressefeed?type=102', 'charite'),
  ('campuslife', 'ruprecht', 'https://www.ruprecht.de/feed/', 'heidelberg'),
  ('announcements', 'WU News', 'https://www.wu.ac.at/en/the-university/news-and-events/news?type=9818', 'wu'),
  ('campuslife', 'Delta', 'https://delta.tudelft.nl/en/feed', 'tudelft'),
  ('campuslife', 'Folia', 'https://www.folia.nl/rss', 'uva'),
  ('campuslife', 'DUB', 'https://dub.uu.nl/en/rss.xml', 'utrecht'),
  ('campuslife', 'UKrant', 'https://ukrant.nl/feed/', 'rug'),
  ('campuslife', 'Resource', 'https://www.resource-online.nl/index.php/feed/', 'wur'),
  ('campuslife', 'Ad Valvas', 'https://advalvas.vu.nl/en/feed/', 'vuamsterdam'),
  ('campuslife', 'U-Today', 'https://www.utoday.nl/rss/', 'utwente'),
  ('campuslife', 'Vox', 'https://www.voxweb.nl/en/feed', 'radboud'),
  ('campuslife', 'Schamper', 'https://schamper.ugent.be/feed/', 'ugent'),
  ('announcements', 'Ghent University News', 'https://www.ugent.be/en/news-events/overview/rss.xml', 'ugent'),
  ('announcements', 'ULB Actus', 'https://actus.ulb.be/adminsite/webservices/export_rss.jsp?NOMBRE=10&CODE_RUBRIQUE=1531226487406&LANGUE=0', 'ulb'),
  ('announcements', 'VUB Press', 'https://press.vub.ac.be/feed', 'vub')
ON CONFLICT (url) DO NOTHING;
