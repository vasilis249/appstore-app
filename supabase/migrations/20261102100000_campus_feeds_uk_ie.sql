-- Campus news for the UK / Irish universities (user request 2026-10-11): student papers → Φοιτητική ζωή, official news
-- → Ανακοινώσεις. Every URL checked on 2026-10-11 the way private.fetch_news fetches it (SpeakBot user agent, no
-- redirect: final URLs, RSS 2.0 parsed after stripping the XML declaration) and active (newest item ≤ 60 days).
-- None found (no RSS, behind a Cloudflare challenge or a dead domain): UCL, Edinburgh, Durham, Sheffield, QMUL, Bath,
-- Lancaster, City St George's, and the official news of most others.
INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('campuslife', 'Cherwell', 'https://cherwell.org/feed/', 'oxford'),
  ('campuslife', 'The Oxford Student', 'https://www.oxfordstudent.com/feed/', 'oxford'),
  ('announcements', 'University of Cambridge News', 'https://www.cam.ac.uk/news/feed', 'cambridge'),
  ('campuslife', 'Felix', 'https://felixonline.co.uk/rss/', 'imperial'),
  ('campuslife', 'Roar News', 'https://roarnews.co.uk/feed/', 'kcl'),
  ('campuslife', 'The Mancunion', 'https://mancunion.com/feed', 'manchester'),
  ('campuslife', 'Epigram', 'https://epigram.org.uk/latest/rss/', 'bristol'),
  ('announcements', 'University of Bristol News', 'https://www.bristol.ac.uk/news/news-feed.rss', 'bristol'),
  ('campuslife', 'The Boar', 'https://theboar.org/feed/', 'warwick'),
  ('campuslife', 'The Glasgow Guardian', 'https://glasgowguardian.co.uk/feed/', 'glasgow'),
  ('announcements', 'University of St Andrews News', 'https://news.st-andrews.ac.uk/feed/', 'standrews'),
  ('campuslife', 'Wessex Scene', 'https://www.wessexscene.co.uk/feed/', 'southampton'),
  ('campuslife', 'The Gryphon', 'https://www.thegryphon.co.uk/feed/', 'leeds'),
  ('campuslife', 'Redbrick', 'https://www.redbrick.me/feed/', 'birmingham'),
  ('campuslife', 'Impact', 'https://impactnottingham.com/feed/', 'nottingham'),
  ('campuslife', 'Exeposé', 'https://exepose.com/feed/', 'exeter'),
  ('announcements', 'University of Exeter News', 'https://news.exeter.ac.uk/feed/', 'exeter'),
  ('campuslife', 'York Vision', 'https://www.yorkvision.co.uk/feed', 'york'),
  ('campuslife', 'The Strathclyde Telegraph', 'https://strathclydetelegraph.com/feed/', 'strathclyde'),
  ('campuslife', 'The University Times', 'https://universitytimes.ie/feed/', 'tcd'),
  ('campuslife', 'Trinity News', 'https://www.trinitynews.ie/feed/', 'tcd'),
  ('campuslife', 'College Tribune', 'https://www.collegetribune.ie/feed/', 'ucd')
ON CONFLICT (url) DO NOTHING;
