-- Campus news for the Nordic and central / eastern universities (user request 2026-10-11): student papers → Φοιτητική
-- ζωή, official news → Ανακοινώσεις (English edition when it is active). Checked 2026-10-11 with
-- supabase/data/check_feeds.py (final URLs, SpeakBot UA). None found / inactive for DTU, Aarhus, CBS, Karolinska, KTH,
-- Uppsala, Stockholm, Chalmers, Gothenburg, SSE, Oslo, NTNU, Bergen, BI, Jagiellonian, Charles, CTU, ELTE, Sofia,
-- Zagreb, Vilnius, RTU.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('campuslife', 'Uniavisen', 'https://uniavisen.dk/en/feed/', 'ucph'),
  ('campuslife', 'Lundagård', 'https://www.lundagard.se/feed/', 'lund'),
  ('campuslife', 'Ylioppilaslehti', 'https://ylioppilaslehti.fi/feed/', 'helsinki'),
  ('announcements', 'University of Helsinki News', 'https://www.helsinki.fi/en/rss.xml', 'helsinki'),
  ('announcements', 'Aalto University News', 'https://www.aalto.fi/en/news/feed', 'aalto'),
  ('announcements', 'University of Iceland News', 'https://english.hi.is/rss.xml', 'hi'),
  ('announcements', 'University of Warsaw News', 'https://en.uw.edu.pl/feed/', 'uw'),
  ('announcements', 'Politechnika Warszawska', 'https://www.pw.edu.pl/rss.xml', 'pw'),
  ('announcements', 'BME News', 'https://www.bme.hu/en/rss.xml', 'bme'),
  ('announcements', 'Universitatea din București', 'https://unibuc.ro/feed/', 'unibuc'),
  ('announcements', 'Univerzitet u Beogradu', 'https://www.bg.ac.rs/feed/', 'bgacrs'),
  ('announcements', 'University of Ljubljana News', 'https://www.uni-lj.si/en/news/rss.xml', 'unilj'),
  ('announcements', 'University of Tartu News', 'https://ut.ee/en/rss.xml', 'tartu')
ON CONFLICT (url) DO NOTHING;
