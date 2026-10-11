-- London School of Economics and Political Science (LSE), user request 2026-10-11. Students and staff have @lse.ac.uk
-- addresses (MX checked 2026-10-11). Departments = its academic departments (lse.ac.uk → Departments and institutes),
-- named in English as LSE does; 3 years (UK undergraduate; master's and PhD as everywhere). LSE has no public news
-- RSS; campus news = The Beaver, the LSE Students' Union paper (thebeaverlse.co.uk — NOT beaveronline.co.uk, a recipe
-- site now) → Φοιτητική ζωή.
INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES
  ('lse', 'London School of Economics (LSE)', 'London School of Economics and Political Science', 'LSE', 'LSE', ARRAY['lse.ac.uk'],
   'Λονδίνο, Ηνωμένο Βασίλειο', true, 61)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES
  ('lse-accounting', 'lse', 'Accounting', 'Accounting', 'Accounting', 'Accounting', 3, 1),
  ('lse-anthropology', 'lse', 'Anthropology', 'Anthropology', 'Anthropology', 'Anthropology', 3, 2),
  ('lse-econhist', 'lse', 'Economic History', 'Economic History', 'Economic History', 'Economic History', 3, 3),
  ('lse-economics', 'lse', 'Economics', 'Economics', 'Economics', 'Economics', 3, 4),
  ('lse-european', 'lse', 'European Institute', 'European Institute', 'European Institute', 'European Institute', 3, 5),
  ('lse-finance', 'lse', 'Finance', 'Finance', 'Finance', 'Finance', 3, 6),
  ('lse-gender', 'lse', 'Gender Studies', 'Gender Studies', 'Gender Studies', 'Gender Studies', 3, 7),
  ('lse-geography', 'lse', 'Geography and Environment', 'Geography and Environment', 'Geography', 'Geography', 3, 8),
  ('lse-government', 'lse', 'Government', 'Government', 'Government', 'Government', 3, 9),
  ('lse-health', 'lse', 'Health Policy', 'Health Policy', 'Health Policy', 'Health Policy', 3, 10),
  ('lse-history', 'lse', 'History', 'History', 'History', 'History', 3, 11),
  ('lse-intdev', 'lse', 'International Development', 'International Development', 'International Development', 'International Development', 3, 12),
  ('lse-inthistory', 'lse', 'International History', 'International History', 'International History', 'International History', 3, 13),
  ('lse-ir', 'lse', 'International Relations', 'International Relations', 'International Relations', 'International Relations', 3, 14),
  ('lse-law', 'lse', 'LSE Law School', 'LSE Law School', 'Law', 'Law', 3, 15),
  ('lse-management', 'lse', 'Management', 'Management', 'Management', 'Management', 3, 16),
  ('lse-maths', 'lse', 'Mathematics', 'Mathematics', 'Mathematics', 'Mathematics', 3, 17),
  ('lse-media', 'lse', 'Media and Communications', 'Media and Communications', 'Media & Communications', 'Media & Communications', 3, 18),
  ('lse-methodology', 'lse', 'Methodology', 'Methodology', 'Methodology', 'Methodology', 3, 19),
  ('lse-philosophy', 'lse', 'Philosophy, Logic and Scientific Method', 'Philosophy, Logic and Scientific Method', 'Philosophy', 'Philosophy', 3, 20),
  ('lse-psychology', 'lse', 'Psychological and Behavioural Science', 'Psychological and Behavioural Science', 'Psychology', 'Psychology', 3, 21),
  ('lse-publicpolicy', 'lse', 'School of Public Policy', 'School of Public Policy', 'Public Policy', 'Public Policy', 3, 22),
  ('lse-socialpolicy', 'lse', 'Social Policy', 'Social Policy', 'Social Policy', 'Social Policy', 3, 23),
  ('lse-sociology', 'lse', 'Sociology', 'Sociology', 'Sociology', 'Sociology', 3, 24),
  ('lse-statistics', 'lse', 'Statistics', 'Statistics', 'Statistics', 'Statistics', 3, 25)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('campuslife', 'The Beaver', 'https://thebeaverlse.co.uk/feed/', 'lse')
ON CONFLICT (url) DO NOTHING;
