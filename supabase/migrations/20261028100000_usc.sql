-- University of Southern California (Los Angeles), user request 2026-10-03. Students and staff have @usc.edu
-- addresses (MX checked 2026-10-03). Departments = its schools (usc.edu → Academics → Schools), named in English
-- as USC does; 4 years. Campus news from USC Today's RSS.
INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES
  ('usc', 'University of Southern California (USC)', 'University of Southern California', 'USC', 'USC', ARRAY['usc.edu'],
   'Los Angeles, ΗΠΑ', true, 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES
  ('usc-dornsife', 'usc', 'Dornsife College of Letters, Arts and Sciences', 'Dornsife College of Letters, Arts and Sciences', 'Dornsife', 'Dornsife', 4, 1),
  ('usc-viterbi', 'usc', 'Viterbi School of Engineering', 'Viterbi School of Engineering', 'Viterbi', 'Viterbi', 4, 2),
  ('usc-marshall', 'usc', 'Marshall School of Business', 'Marshall School of Business', 'Marshall', 'Marshall', 4, 3),
  ('usc-leventhal', 'usc', 'Leventhal School of Accounting', 'Leventhal School of Accounting', 'Leventhal', 'Leventhal', 4, 4),
  ('usc-annenberg', 'usc', 'Annenberg School for Communication and Journalism', 'Annenberg School for Communication and Journalism', 'Annenberg', 'Annenberg', 4, 5),
  ('usc-cinema', 'usc', 'School of Cinematic Arts', 'School of Cinematic Arts', 'Cinematic Arts', 'Cinematic Arts', 4, 6),
  ('usc-thornton', 'usc', 'Thornton School of Music', 'Thornton School of Music', 'Thornton', 'Thornton', 4, 7),
  ('usc-roski', 'usc', 'Roski School of Art and Design', 'Roski School of Art and Design', 'Roski', 'Roski', 4, 8),
  ('usc-kaufman', 'usc', 'Kaufman School of Dance', 'Kaufman School of Dance', 'Kaufman', 'Kaufman', 4, 9),
  ('usc-drama', 'usc', 'School of Dramatic Arts', 'School of Dramatic Arts', 'Dramatic Arts', 'Dramatic Arts', 4, 10),
  ('usc-arch', 'usc', 'School of Architecture', 'School of Architecture', 'Architecture', 'Architecture', 4, 11),
  ('usc-iovine', 'usc', 'Iovine and Young Academy', 'Iovine and Young Academy', 'Iovine & Young', 'Iovine & Young', 4, 12),
  ('usc-price', 'usc', 'Price School of Public Policy', 'Price School of Public Policy', 'Price', 'Price', 4, 13),
  ('usc-gould', 'usc', 'Gould School of Law', 'Gould School of Law', 'Gould Law', 'Gould Law', 4, 14),
  ('usc-keck', 'usc', 'Keck School of Medicine', 'Keck School of Medicine', 'Keck Medicine', 'Keck Medicine', 4, 15),
  ('usc-ostrow', 'usc', 'Ostrow School of Dentistry', 'Ostrow School of Dentistry', 'Ostrow Dentistry', 'Ostrow Dentistry', 4, 16),
  ('usc-mann', 'usc', 'Mann School of Pharmacy and Pharmaceutical Sciences', 'Mann School of Pharmacy and Pharmaceutical Sciences', 'Mann Pharmacy', 'Mann Pharmacy', 4, 17),
  ('usc-rossier', 'usc', 'Rossier School of Education', 'Rossier School of Education', 'Rossier', 'Rossier', 4, 18),
  ('usc-socialwork', 'usc', 'Dworak-Peck School of Social Work', 'Dworak-Peck School of Social Work', 'Social Work', 'Social Work', 4, 19),
  ('usc-gerontology', 'usc', 'Leonard Davis School of Gerontology', 'Leonard Davis School of Gerontology', 'Gerontology', 'Gerontology', 4, 20),
  ('usc-chan', 'usc', 'Chan Division of Occupational Science and Occupational Therapy', 'Chan Division of Occupational Science and Occupational Therapy', 'Occupational Therapy', 'Occupational Therapy', 4, 21),
  ('usc-bovard', 'usc', 'Bovard College', 'Bovard College', 'Bovard', 'Bovard', 4, 22)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.news_feeds (section_id, name, url, university_id) VALUES
  ('announcements', 'USC Today', 'https://today.usc.edu/feed/', 'usc')
ON CONFLICT (url) DO NOTHING;
