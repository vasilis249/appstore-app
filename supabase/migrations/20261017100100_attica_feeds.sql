-- Campus news for the Attica universities: each institution's own RSS (news + announcements), into its campus's
-- "Ανακοινώσεις" section — like ΕΜΠ's feeds. Only feeds that give an article link per item and are updated:
--   ΕΚΠΑ: hub.uoa.gr (the uoa.gr feed has empty <link>s and is 3.6 MB), ΟΠΑ: aueb.gr (quiet since June — kept,
--   ingest only takes items ≤ 36 h old), Πάντειο, ΠΑΔΑ, Χαροκόπειο, ΑΣΚΤ, ΑΣΠΑΙΤΕ: their WordPress feeds.
--   ΓΠΑ (empty feed) and ΠΑΠΕΙ (no feed found) have none yet; admins can still post campus topics there.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'ΕΚΠΑ', 'https://hub.uoa.gr/feed/', 'uoa'),
  ('announcements', 'ΟΠΑ', 'https://www.aueb.gr/el/rss.xml', 'aueb'),
  ('announcements', 'Πάντειο', 'https://www.panteion.gr/feed/', 'panteion'),
  ('announcements', 'ΠΑΔΑ', 'https://www.uniwa.gr/feed/', 'uniwa'),
  ('announcements', 'Χαροκόπειο', 'https://www.hua.gr/feed/', 'hua'),
  ('announcements', 'ΑΣΚΤ', 'https://www.asfa.gr/feed/', 'asfa'),
  ('announcements', 'ΑΣΠΑΙΤΕ', 'https://www.aspete.gr/feed/', 'aspete')
ON CONFLICT (url) DO NOTHING;
