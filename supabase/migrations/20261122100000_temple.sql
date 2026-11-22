-- Temple University (Philadelphia), user request 2026-11-22. Students and staff have @temple.edu addresses (MX checked
-- 2026-11-22: Microsoft 365). Departments = its schools and colleges (temple.edu → Academics), English names as Temple
-- uses them, 4 years; short names = full names (rule since 2026-10-13). Campus news: Temple Now's RSS. Not added:
-- The Temple News (student paper) and Temple Owls athletics (incl. fencing) refuse automated fetches (HTTP 403).
INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position, min_students) VALUES
  ('temple', 'Temple University', 'Temple University', 'Temple University', 'Temple University', ARRAY['temple.edu'],
   'Φιλαδέλφεια, ΗΠΑ', true, 62, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position)
SELECT 'temple-' || slug, 'temple', name, name, short, short, 4, pos
FROM (VALUES
  ('fox', 'Fox School of Business and Management', 'Fox Business', 1),
  ('engineering', 'College of Engineering', 'Engineering', 2),
  ('cst', 'College of Science and Technology', 'Science and Technology', 3),
  ('cla', 'College of Liberal Arts', 'Liberal Arts', 4),
  ('klein', 'Lew Klein College of Media and Communication', 'Klein Media', 5),
  ('tyler', 'Tyler School of Art and Architecture', 'Tyler Art and Architecture', 6),
  ('boyer', 'Boyer College of Music and Dance', 'Boyer Music and Dance', 7),
  ('tfma', 'School of Theater, Film and Media Arts', 'Theater, Film and Media Arts', 8),
  ('education', 'College of Education and Human Development', 'Education', 9),
  ('cph', 'College of Public Health', 'Public Health', 10),
  ('sthm', 'School of Sport, Tourism and Hospitality Management', 'Sport, Tourism and Hospitality', 11),
  ('law', 'Beasley School of Law', 'Beasley Law', 12),
  ('medicine', 'Lewis Katz School of Medicine', 'Katz Medicine', 13),
  ('dentistry', 'Kornberg School of Dentistry', 'Kornberg Dentistry', 14),
  ('pharmacy', 'School of Pharmacy', 'Pharmacy', 15),
  ('podiatry', 'School of Podiatric Medicine', 'Podiatric Medicine', 16)
) AS d(slug, name, short, pos)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'Temple Now', 'https://now.temple.edu/rss.xml', 'temple')
ON CONFLICT (url) DO NOTHING;
