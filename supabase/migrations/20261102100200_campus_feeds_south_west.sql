-- Campus news for FR / IT / ES / PT (user request 2026-10-11): official news → Ανακοινώσεις (English edition when it is
-- active, else the local one). Checked 2026-10-11 with supabase/data/check_feeds.py (final URLs, SpeakBot UA, newest
-- item ≤ 30 days). None found / inactive for Polytechnique, HEC, Paris 1, ESSEC, INSEAD, Strasbourg, ENS Paris-Saclay,
-- ENS Lyon, Aix-Marseille, Florence (HTTP 403 to Supabase), Polimi, Bocconi, Bologna, Naples, Turin, LUISS, most
-- Spanish universities, Coimbra, NOVA, Malta.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'Sciences Po News', 'https://www.sciencespo.fr/en/news-rss.xml', 'sciencespo'),
  ('announcements', 'PSL News', 'https://psl.eu/en/rss.xml', 'psl'),
  ('announcements', 'Sorbonne Université News', 'https://www.sorbonne-universite.fr/en/rss.xml', 'sorbonne'),
  ('announcements', 'Université Paris-Saclay News', 'https://www.universite-paris-saclay.fr/en/rss.xml', 'parissaclay'),
  ('announcements', 'Université Paris Cité News', 'https://u-paris.fr/language/en/feed/', 'upcite'),
  ('announcements', 'CentraleSupélec Actualités', 'https://www.centralesupelec.fr/rss.xml', 'centralesupelec'),
  ('announcements', 'UGA Actualités', 'https://www.univ-grenoble-alpes.fr/adminsite/webservices/export_rss.jsp?NOMBRE=10&CODE_RUBRIQUE=589794739900719&LANGUE=0', 'uga'),
  ('announcements', 'Sapienza News', 'https://www.uniroma1.it/en/rss.xml', 'sapienza'),
  ('announcements', 'Politecnico di Torino News', 'https://www.polito.it/en/rss.xml', 'polito'),
  ('announcements', 'Scuola Normale News', 'https://www.sns.it/en/rss.xml', 'sns'),
  ('announcements', 'La Statale News', 'https://lastatalenews.unimi.it/rss.xml', 'unimi'),
  ('announcements', 'Università di Pisa News', 'https://www.unipi.it/news/feed/', 'unipisa'),
  ('announcements', 'Il Bo Live', 'https://ilbolive.unipd.it/it/rss.xml', 'unipd'),
  ('announcements', 'UPC Notícies', 'https://www.upc.edu/rss.xml', 'upc'),
  ('announcements', 'ULisboa News', 'https://www.ulisboa.pt/en/rss.xml', 'ulisboa'),
  ('announcements', 'Notícias U.Porto', 'https://noticias.up.pt/feed/', 'uporto')
ON CONFLICT (url) DO NOTHING;
