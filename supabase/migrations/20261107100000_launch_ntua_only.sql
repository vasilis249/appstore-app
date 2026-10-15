-- Launch focus (user decision 2026-10-15): one campus first.
-- ΕΜΠ is open; every other campus waits until 100 verified students have joined (they still sign up, join groups, send
-- messages and invite: the existing campus_status / CampusWaiting flow). General student news (non-campus feeds) is
-- off: the app no longer shows a News feed, and campus feeds keep bringing each university's own announcements.

UPDATE public.universities SET min_students = CASE WHEN id = 'ntua' THEN 0 ELSE 100 END;

UPDATE private.news_feeds SET enabled = false WHERE university_id IS NULL;
