-- ACG / Deree (Αγία Παρασκευή): "Deree, The American University of Greece" of The American College of Greece,
-- licensed as a non-state university (Law 5094/2024) on 2026-07-24; students have @acg.edu addresses
-- (webmail.acg.edu). Departments = its undergraduate majors (acg.edu → Undergraduate programs, three
-- schools), named in English as the college does (teaching is in English); 4 years. Campus news from its RSS.
INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES
  ('acg', 'Deree — The American University of Greece (ACG)', 'Deree — The American University of Greece (ACG)', 'ACG', 'ACG', ARRAY['acg.edu'],
   'Αγία Παρασκευή', true, 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES
  -- School of Business and Economics
  ('acg-accfin', 'acg', 'Accounting and Finance', 'Accounting and Finance', 'Accounting & Finance', 'Accounting & Finance', 4, 1),
  ('acg-busan', 'acg', 'Business Analytics', 'Business Analytics', 'Business Analytics', 'Business Analytics', 4, 2),
  ('acg-econ', 'acg', 'Economics', 'Economics', 'Economics', 'Economics', 4, 3),
  ('acg-entre', 'acg', 'Entrepreneurship Management', 'Entrepreneurship Management', 'Entrepreneurship', 'Entrepreneurship', 4, 4),
  ('acg-fin', 'acg', 'Finance', 'Finance', 'Finance', 'Finance', 4, 5),
  ('acg-hrm', 'acg', 'Human Resource Management', 'Human Resource Management', 'HRM', 'HRM', 4, 6),
  ('acg-ib', 'acg', 'International Business', 'International Business', 'International Business', 'International Business', 4, 7),
  ('acg-lscm', 'acg', 'Logistics and Supply Chain Management', 'Logistics and Supply Chain Management', 'Logistics & SCM', 'Logistics & SCM', 4, 8),
  ('acg-mis', 'acg', 'Management Information Systems', 'Management Information Systems', 'MIS', 'MIS', 4, 9),
  ('acg-mkt', 'acg', 'Marketing', 'Marketing', 'Marketing', 'Marketing', 4, 10),
  ('acg-ops', 'acg', 'Operations Management', 'Operations Management', 'Operations', 'Operations', 4, 11),
  ('acg-tour', 'acg', 'International Tourism and Hospitality Management', 'International Tourism and Hospitality Management', 'Tourism & Hospitality', 'Tourism & Hospitality', 4, 12),
  ('acg-ship', 'acg', 'Shipping Management', 'Shipping Management', 'Shipping', 'Shipping', 4, 13),
  ('acg-sport', 'acg', 'Sports Management', 'Sports Management', 'Sports Management', 'Sports Management', 4, 14),
  -- School of Science and Technology
  ('acg-biomed', 'acg', 'Biomedical Sciences', 'Biomedical Sciences', 'Biomedical Sciences', 'Biomedical Sciences', 4, 15),
  ('acg-bioinf', 'acg', 'Bioinformatics', 'Bioinformatics', 'Bioinformatics', 'Bioinformatics', 4, 16),
  ('acg-cyber', 'acg', 'Cybersecurity and Networks', 'Cybersecurity and Networks', 'Cybersecurity', 'Cybersecurity', 4, 17),
  ('acg-env', 'acg', 'Environmental Studies', 'Environmental Studies', 'Environmental Studies', 'Environmental Studies', 4, 18),
  ('acg-it', 'acg', 'Information Technology', 'Information Technology', 'IT', 'IT', 4, 19),
  ('acg-psych', 'acg', 'Psychology', 'Psychology', 'Psychology', 'Psychology', 4, 20),
  -- Frances Rich School of Arts, Humanities and Social Sciences
  ('acg-comm', 'acg', 'Communication', 'Communication', 'Communication', 'Communication', 4, 21),
  ('acg-englit', 'acg', 'English Literature with Linguistics', 'English Literature with Linguistics', 'English Lit. & Linguistics', 'English Lit. & Linguistics', 4, 22),
  ('acg-engam', 'acg', 'English and American Literature', 'English and American Literature', 'English & American Lit.', 'English & American Lit.', 4, 23),
  ('acg-hist', 'acg', 'History', 'History', 'History', 'History', 4, 24),
  ('acg-irea', 'acg', 'International Relations and European Affairs', 'International Relations and European Affairs', 'International Relations', 'International Relations', 4, 25),
  ('acg-phil', 'acg', 'Philosophy', 'Philosophy', 'Philosophy', 'Philosophy', 4, 26),
  ('acg-soc', 'acg', 'Sociology', 'Sociology', 'Sociology', 'Sociology', 4, 27),
  ('acg-cinema', 'acg', 'Cinema Studies', 'Cinema Studies', 'Cinema Studies', 'Cinema Studies', 4, 28),
  ('acg-dance', 'acg', 'Contemporary Dance Practice', 'Contemporary Dance Practice', 'Dance', 'Dance', 4, 29),
  ('acg-musperf', 'acg', 'Music Performance', 'Music Performance', 'Music Performance', 'Music Performance', 4, 30),
  ('acg-music', 'acg', 'Music', 'Music', 'Music', 'Music', 4, 31),
  ('acg-theater', 'acg', 'Theater Arts', 'Theater Arts', 'Theater Arts', 'Theater Arts', 4, 32),
  ('acg-arthist', 'acg', 'Art History', 'Art History', 'Art History', 'Art History', 4, 33),
  ('acg-graphic', 'acg', 'Graphic Design', 'Graphic Design', 'Graphic Design', 'Graphic Design', 4, 34),
  ('acg-visual', 'acg', 'Visual Arts', 'Visual Arts', 'Visual Arts', 'Visual Arts', 4, 35)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'ACG', 'https://www.acg.edu/feed/', 'acg')
ON CONFLICT (url) DO NOTHING;
