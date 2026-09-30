-- Campus beyond ΕΜΠ: the other public universities (ΑΕΙ) of Attica with their departments and student email domains.
-- Department lists: each institution's current structure (Wikipedia, checked against the ΑΣΠΑΙΤΕ site). Every
-- campus starts open (min_students 0, like ΕΜΠ); an admin raises the threshold per campus from Admin topics.
--
-- Year codes: undergraduate years are now 1–6 (Medicine has 6), so master's / PhD move from 6 / 7 to 8 / 9.

-- ---------------------------------------------------------------------------
-- 1. Year codes
-- ---------------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname, conrelid::regclass AS rel FROM pg_constraint
    WHERE contype = 'c' AND conrelid IN ('public.profiles'::regclass, 'public.groups'::regclass)
      AND pg_get_constraintdef(oid) LIKE '%study_year%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.rel, c.conname);
  END LOOP;
END $$;

-- Groups first, so the profile trigger finds each student's (renumbered) group still fitting.
UPDATE public.groups SET study_year = study_year + 2 WHERE study_year IN (6, 7);
UPDATE public.profiles SET study_year = study_year + 2 WHERE study_year IN (6, 7);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_study_year_check CHECK (study_year BETWEEN 1 AND 6 OR study_year IN (8, 9));
ALTER TABLE public.groups ADD CONSTRAINT groups_study_year_check CHECK (study_year BETWEEN 1 AND 6 OR study_year IN (8, 9));
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_years_check;
ALTER TABLE public.departments ADD CONSTRAINT departments_years_check CHECK (years BETWEEN 1 AND 6);

CREATE OR REPLACE FUNCTION private.year_label(p_year int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_year BETWEEN 1 AND 6 THEN p_year || 'ο έτος' WHEN p_year = 8 THEN 'Μεταπτυχιακό'
              WHEN p_year = 9 THEN 'Διδακτορικό' END
$$;

-- School and year (verified students; either may be left empty). A year must exist in that department.
CREATE OR REPLACE FUNCTION public.set_student_info(p_department text, p_year int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  uni text;
  max_year int := 6;
BEGIN
  SELECT university_id INTO uni FROM public.profiles WHERE id = uid;
  IF uni IS NULL THEN RAISE EXCEPTION 'not_verified' USING ERRCODE = '42501'; END IF;
  IF p_department IS NOT NULL THEN
    SELECT years INTO max_year FROM public.departments WHERE id = p_department AND university_id = uni;
    IF NOT FOUND THEN RAISE EXCEPTION 'bad_department' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p_year IS NOT NULL AND NOT (p_year BETWEEN 1 AND max_year OR p_year IN (8, 9)) THEN
    RAISE EXCEPTION 'bad_year' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET department_id = p_department, study_year = p_year WHERE id = uid;
END $$;

-- Auto group descriptions that read right for every institution ("Σχολή" is ΕΜΠ's word, "Τμήμα" everyone else's).
CREATE OR REPLACE FUNCTION private.auto_group_description(p_department text, p_year int)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.year_label(p_year), 'Όλα τα έτη') || ' · ' || d.name_el || ' · ' || u.short_el || '.'
  FROM public.departments d JOIN public.universities u ON u.id = d.university_id
  WHERE d.id = p_department
$$;

CREATE OR REPLACE FUNCTION private.auto_group(p_department text, p_year int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  gid uuid;
  d public.departments;
  u public.universities;
BEGIN
  SELECT id INTO gid FROM public.groups WHERE auto AND department_id = p_department AND coalesce(study_year, 0) = coalesce(p_year, 0);
  IF FOUND THEN RETURN gid; END IF;
  SELECT * INTO d FROM public.departments WHERE id = p_department;
  SELECT * INTO u FROM public.universities WHERE id = d.university_id;
  INSERT INTO public.groups (name, description, section_id, privacy, auto, university_id, department_id, study_year)
  VALUES (
    left(concat_ws(' · ', u.short_el, d.short_el, private.year_label(p_year)), 60),
    left(private.auto_group_description(p_department, p_year), 300),
    'courses', 'private', true, u.id, d.id, p_year)
  ON CONFLICT DO NOTHING
  RETURNING id INTO gid;
  IF gid IS NULL THEN  -- made at the same moment by someone else
    SELECT id INTO gid FROM public.groups WHERE auto AND department_id = p_department AND coalesce(study_year, 0) = coalesce(p_year, 0);
  END IF;
  RETURN gid;
END $$;

UPDATE public.groups g SET description = left(private.auto_group_description(g.department_id, g.study_year), 300)
WHERE g.auto AND g.department_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Universities and departments
-- ---------------------------------------------------------------------------
INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES
  ('uoa', 'Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών', 'National and Kapodistrian University of Athens', 'ΕΚΠΑ', 'NKUA', ARRAY['uoa.gr'], 'Αθήνα', true, 2),
  ('aueb', 'Οικονομικό Πανεπιστήμιο Αθηνών', 'Athens University of Economics and Business', 'ΟΠΑ', 'AUEB', ARRAY['aueb.gr'], 'Αθήνα', true, 3),
  ('unipi', 'Πανεπιστήμιο Πειραιώς', 'University of Piraeus', 'ΠΑΠΕΙ', 'UNIPI', ARRAY['unipi.gr'], 'Πειραιάς', true, 4),
  ('panteion', 'Πάντειο Πανεπιστήμιο Κοινωνικών και Πολιτικών Επιστημών', 'Panteion University of Social and Political Sciences', 'Πάντειο', 'Panteion', ARRAY['panteion.gr'], 'Αθήνα', true, 5),
  ('uniwa', 'Πανεπιστήμιο Δυτικής Αττικής', 'University of West Attica', 'ΠΑΔΑ', 'UNIWA', ARRAY['uniwa.gr'], 'Αιγάλεω', true, 6),
  ('aua', 'Γεωπονικό Πανεπιστήμιο Αθηνών', 'Agricultural University of Athens', 'ΓΠΑ', 'AUA', ARRAY['aua.gr'], 'Αθήνα', true, 7),
  ('hua', 'Χαροκόπειο Πανεπιστήμιο', 'Harokopio University', 'Χαροκόπειο', 'HUA', ARRAY['hua.gr'], 'Καλλιθέα', true, 8),
  ('asfa', 'Ανώτατη Σχολή Καλών Τεχνών', 'Athens School of Fine Arts', 'ΑΣΚΤ', 'ASFA', ARRAY['asfa.gr'], 'Αθήνα', true, 9),
  ('aspete', 'Ανώτατη Σχολή Παιδαγωγικής και Τεχνολογικής Εκπαίδευσης', 'School of Pedagogical and Technological Education', 'ΑΣΠΑΙΤΕ', 'ASPETE', ARRAY['aspete.gr'], 'Μαρούσι', true, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES
  -- ΕΚΠΑ
  ('uoa-theol', 'uoa', 'Θεολογίας', 'Theology', 'Θεολογία', 'Theology', 4, 1),
  ('uoa-soctheol', 'uoa', 'Κοινωνικής Θεολογίας και Θρησκειολογίας', 'Social Theology and Religious Studies', 'Κοινωνική Θεολογία', 'Social Theology', 4, 2),
  ('uoa-phil', 'uoa', 'Φιλολογίας', 'Philology', 'Φιλολογία', 'Philology', 4, 3),
  ('uoa-hist-arch', 'uoa', 'Ιστορίας και Αρχαιολογίας', 'History and Archaeology', 'Ιστορία & Αρχαιολογία', 'History & Archaeology', 4, 4),
  ('uoa-philosophy', 'uoa', 'Φιλοσοφίας', 'Philosophy', 'Φιλοσοφία', 'Philosophy', 4, 5),
  ('uoa-secedu', 'uoa', 'Παιδαγωγικό Τμήμα Δευτεροβάθμιας Εκπαίδευσης', 'Secondary Education', 'Παιδαγωγικό Δευτεροβάθμιας', 'Secondary Education', 4, 6),
  ('uoa-english', 'uoa', 'Αγγλικής Γλώσσας και Φιλολογίας', 'English Language and Literature', 'Αγγλική Φιλολογία', 'English', 4, 7),
  ('uoa-french', 'uoa', 'Γαλλικής Γλώσσας και Φιλολογίας', 'French Language and Literature', 'Γαλλική Φιλολογία', 'French', 4, 8),
  ('uoa-german', 'uoa', 'Γερμανικής Γλώσσας και Φιλολογίας', 'German Language and Literature', 'Γερμανική Φιλολογία', 'German', 4, 9),
  ('uoa-italian', 'uoa', 'Ιταλικής Γλώσσας και Φιλολογίας', 'Italian Language and Literature', 'Ιταλική Φιλολογία', 'Italian', 4, 10),
  ('uoa-spanish', 'uoa', 'Ισπανικής Γλώσσας και Φιλολογίας', 'Spanish Language and Literature', 'Ισπανική Φιλολογία', 'Spanish', 4, 11),
  ('uoa-slavic', 'uoa', 'Ρωσικής Γλώσσας και Φιλολογίας και Σλαβικών Σπουδών', 'Russian Language, Literature and Slavic Studies', 'Ρωσική Φιλολογία', 'Russian & Slavic', 4, 12),
  ('uoa-theatre', 'uoa', 'Θεατρικών Σπουδών', 'Theatre Studies', 'Θεατρικές Σπουδές', 'Theatre', 4, 13),
  ('uoa-music', 'uoa', 'Μουσικών Σπουδών', 'Music Studies', 'Μουσικές Σπουδές', 'Music', 4, 14),
  ('uoa-psych', 'uoa', 'Ψυχολογίας', 'Psychology', 'Ψυχολογία', 'Psychology', 4, 15),
  ('uoa-ppp', 'uoa', 'Φιλοσοφίας – Παιδαγωγικής και Ψυχολογίας', 'Philosophy, Pedagogy and Psychology', 'ΦΠΨ', 'PPP', 4, 16),
  ('uoa-math', 'uoa', 'Μαθηματικών', 'Mathematics', 'Μαθηματικό', 'Mathematics', 4, 17),
  ('uoa-phys', 'uoa', 'Φυσικής', 'Physics', 'Φυσικό', 'Physics', 4, 18),
  ('uoa-chem', 'uoa', 'Χημείας', 'Chemistry', 'Χημικό', 'Chemistry', 4, 19),
  ('uoa-biol', 'uoa', 'Βιολογίας', 'Biology', 'Βιολογικό', 'Biology', 4, 20),
  ('uoa-geol', 'uoa', 'Γεωλογίας και Γεωπεριβάλλοντος', 'Geology and Geoenvironment', 'Γεωλογικό', 'Geology', 4, 21),
  ('uoa-di', 'uoa', 'Πληροφορικής και Τηλεπικοινωνιών', 'Informatics and Telecommunications', 'Πληροφορική', 'Informatics', 4, 22),
  ('uoa-phs', 'uoa', 'Ιστορίας και Φιλοσοφίας της Επιστήμης', 'History and Philosophy of Science', 'ΙΦΕ', 'HPS', 4, 23),
  ('uoa-dind', 'uoa', 'Τεχνολογιών Ψηφιακής Βιομηχανίας', 'Digital Industry Technologies', 'Ψηφιακή Βιομηχανία', 'Digital Industry', 4, 24),
  ('uoa-aerospace', 'uoa', 'Αεροδιαστημικής Επιστήμης και Τεχνολογίας', 'Aerospace Science and Technology', 'Αεροδιαστημική', 'Aerospace', 5, 25),
  ('uoa-med', 'uoa', 'Ιατρικής', 'Medicine', 'Ιατρική', 'Medicine', 6, 26),
  ('uoa-pharm', 'uoa', 'Φαρμακευτικής', 'Pharmacy', 'Φαρμακευτική', 'Pharmacy', 5, 27),
  ('uoa-dent', 'uoa', 'Οδοντιατρικής', 'Dentistry', 'Οδοντιατρική', 'Dentistry', 5, 28),
  ('uoa-nurs', 'uoa', 'Νοσηλευτικής', 'Nursing', 'Νοσηλευτική', 'Nursing', 4, 29),
  ('uoa-law', 'uoa', 'Νομικής', 'Law', 'Νομική', 'Law', 4, 30),
  ('uoa-econ', 'uoa', 'Οικονομικών Επιστημών', 'Economics', 'Οικονομικό', 'Economics', 4, 31),
  ('uoa-pspa', 'uoa', 'Πολιτικής Επιστήμης και Δημόσιας Διοίκησης', 'Political Science and Public Administration', 'Πολιτικές Επιστήμες', 'Political Science', 4, 32),
  ('uoa-ba', 'uoa', 'Διοίκησης Επιχειρήσεων και Οργανισμών', 'Business Administration', 'Διοίκηση Επιχειρήσεων', 'Business', 4, 33),
  ('uoa-media', 'uoa', 'Επικοινωνίας και Μέσων Μαζικής Ενημέρωσης', 'Communication and Media Studies', 'ΜΜΕ', 'Media', 4, 34),
  ('uoa-soc', 'uoa', 'Κοινωνιολογίας', 'Sociology', 'Κοινωνιολογία', 'Sociology', 4, 35),
  ('uoa-turkish', 'uoa', 'Τουρκικών και Σύγχρονων Ασιατικών Σπουδών', 'Turkish and Modern Asian Studies', 'Τουρκικές Σπουδές', 'Turkish & Asian', 4, 36),
  ('uoa-ports', 'uoa', 'Διαχείρισης Λιμένων και Ναυτιλίας', 'Port Management and Shipping', 'Λιμένες & Ναυτιλία', 'Ports & Shipping', 4, 37),
  ('uoa-dac', 'uoa', 'Ψηφιακών Τεχνών και Κινηματογράφου', 'Digital Arts and Cinema', 'Ψηφιακές Τέχνες', 'Digital Arts', 4, 38),
  ('uoa-primedu', 'uoa', 'Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης', 'Primary Education', 'ΠΤΔΕ', 'Primary Education', 4, 39),
  ('uoa-ecedu', 'uoa', 'Εκπαίδευσης και Αγωγής στην Προσχολική Ηλικία', 'Early Childhood Education', 'ΤΕΑΠΗ', 'Early Childhood', 4, 40),
  ('uoa-phed', 'uoa', 'Επιστήμης Φυσικής Αγωγής και Αθλητισμού', 'Physical Education and Sport Science', 'ΤΕΦΑΑ', 'Sport Science', 4, 41),
  ('uoa-agri', 'uoa', 'Αγροτικής Ανάπτυξης, Αγροδιατροφής και Διαχείρισης Φυσικών Πόρων', 'Agricultural Development, Agri-food and Natural Resources Management', 'Αγροτική Ανάπτυξη', 'Agri Development', 5, 42),
  -- ΟΠΑ
  ('aueb-econ', 'aueb', 'Οικονομικής Επιστήμης', 'Economics', 'Οικονομικό', 'Economics', 4, 1),
  ('aueb-deos', 'aueb', 'Διεθνών και Ευρωπαϊκών Οικονομικών Σπουδών', 'International and European Economic Studies', 'ΔΕΟΣ', 'IEES', 4, 2),
  ('aueb-ode', 'aueb', 'Οργάνωσης και Διοίκησης Επιχειρήσεων', 'Business Administration', 'ΟΔΕ', 'Business', 4, 3),
  ('aueb-mke', 'aueb', 'Μάρκετινγκ και Επικοινωνίας', 'Marketing and Communication', 'Μάρκετινγκ', 'Marketing', 4, 4),
  ('aueb-accfin', 'aueb', 'Λογιστικής και Χρηματοοικονομικής', 'Accounting and Finance', 'ΛΟΧΡΗ', 'Accounting & Finance', 4, 5),
  ('aueb-dmst', 'aueb', 'Διοικητικής Επιστήμης και Τεχνολογίας', 'Management Science and Technology', 'ΔΕΤ', 'DMST', 4, 6),
  ('aueb-cs', 'aueb', 'Πληροφορικής', 'Informatics', 'Πληροφορική', 'Informatics', 4, 7),
  ('aueb-stat', 'aueb', 'Στατιστικής', 'Statistics', 'Στατιστική', 'Statistics', 4, 8),
  -- ΠΑΠΕΙ
  ('unipi-econ', 'unipi', 'Οικονομικής Επιστήμης', 'Economics', 'Οικονομικό', 'Economics', 4, 1),
  ('unipi-bus', 'unipi', 'Οργάνωσης και Διοίκησης Επιχειρήσεων', 'Business Administration', 'ΟΔΕ', 'Business', 4, 2),
  ('unipi-des', 'unipi', 'Διεθνών και Ευρωπαϊκών Σπουδών', 'International and European Studies', 'ΔΕΣ', 'IES', 4, 3),
  ('unipi-tour', 'unipi', 'Τουριστικών Σπουδών', 'Tourism Studies', 'Τουριστικές Σπουδές', 'Tourism', 4, 4),
  ('unipi-mar', 'unipi', 'Ναυτιλιακών Σπουδών', 'Maritime Studies', 'Ναυτιλιακό', 'Maritime', 4, 5),
  ('unipi-ind', 'unipi', 'Βιομηχανικής Διοίκησης και Τεχνολογίας', 'Industrial Management and Technology', 'Βιομηχανική Διοίκηση', 'Industrial Mgmt', 4, 6),
  ('unipi-bankfin', 'unipi', 'Χρηματοοικονομικής και Τραπεζικής Διοικητικής', 'Banking and Financial Management', 'Χρηματοοικονομική', 'Banking & Finance', 4, 7),
  ('unipi-stat', 'unipi', 'Στατιστικής και Ασφαλιστικής Επιστήμης', 'Statistics and Insurance Science', 'Στατιστική', 'Statistics', 4, 8),
  ('unipi-cs', 'unipi', 'Πληροφορικής', 'Informatics', 'Πληροφορική', 'Informatics', 4, 9),
  ('unipi-ds', 'unipi', 'Ψηφιακών Συστημάτων', 'Digital Systems', 'Ψηφιακά Συστήματα', 'Digital Systems', 4, 10),
  -- Πάντειο
  ('panteion-pubadm', 'panteion', 'Δημόσιας Διοίκησης', 'Public Administration', 'Δημόσια Διοίκηση', 'Public Admin', 4, 1),
  ('panteion-erd', 'panteion', 'Οικονομικής και Περιφερειακής Ανάπτυξης', 'Economic and Regional Development', 'Περιφερειακή Ανάπτυξη', 'Regional Development', 4, 2),
  ('panteion-polhist', 'panteion', 'Πολιτικής Επιστήμης και Ιστορίας', 'Political Science and History', 'Πολιτική Επιστήμη', 'Political Science', 4, 3),
  ('panteion-socpol', 'panteion', 'Κοινωνικής Πολιτικής', 'Social Policy', 'Κοινωνική Πολιτική', 'Social Policy', 4, 4),
  ('panteion-soc', 'panteion', 'Κοινωνιολογίας', 'Sociology', 'Κοινωνιολογία', 'Sociology', 4, 5),
  ('panteion-anthro', 'panteion', 'Κοινωνικής Ανθρωπολογίας', 'Social Anthropology', 'Ανθρωπολογία', 'Anthropology', 4, 6),
  ('panteion-psych', 'panteion', 'Ψυχολογίας', 'Psychology', 'Ψυχολογία', 'Psychology', 4, 7),
  ('panteion-ieas', 'panteion', 'Διεθνών, Ευρωπαϊκών και Περιφερειακών Σπουδών', 'International, European and Area Studies', 'Διεθνείς Σπουδές', 'International Studies', 4, 8),
  ('panteion-cmc', 'panteion', 'Επικοινωνίας, Μέσων και Πολιτισμού', 'Communication, Media and Culture', 'Επικοινωνία & Μέσα', 'Media & Culture', 4, 9),
  -- ΠΑΔΑ
  ('uniwa-eee', 'uniwa', 'Ηλεκτρολόγων και Ηλεκτρονικών Μηχανικών', 'Electrical and Electronics Engineering', 'Ηλεκτρολόγοι & Ηλεκτρονικοί', 'EEE', 5, 1),
  ('uniwa-idpe', 'uniwa', 'Μηχανικών Βιομηχανικής Σχεδίασης και Παραγωγής', 'Industrial Design and Production Engineering', 'Βιομηχανική Σχεδίαση', 'Industrial Design', 5, 2),
  ('uniwa-ice', 'uniwa', 'Μηχανικών Πληροφορικής και Υπολογιστών', 'Informatics and Computer Engineering', 'Μηχανικοί Πληροφορικής', 'Computer Eng.', 5, 3),
  ('uniwa-sge', 'uniwa', 'Μηχανικών Τοπογραφίας και Γεωπληροφορικής', 'Surveying and Geoinformatics Engineering', 'Τοπογράφοι', 'Surveying', 5, 4),
  ('uniwa-mech', 'uniwa', 'Μηχανολόγων Μηχανικών', 'Mechanical Engineering', 'Μηχανολόγοι', 'Mechanical', 5, 5),
  ('uniwa-naval', 'uniwa', 'Ναυπηγών Μηχανικών', 'Naval Architecture', 'Ναυπηγοί', 'Naval', 5, 6),
  ('uniwa-civil', 'uniwa', 'Πολιτικών Μηχανικών', 'Civil Engineering', 'Πολιτικοί', 'Civil', 5, 7),
  ('uniwa-bme', 'uniwa', 'Μηχανικών Βιοϊατρικής', 'Biomedical Engineering', 'Βιοϊατρική', 'Biomedical Eng.', 5, 8),
  ('uniwa-bisc', 'uniwa', 'Βιοϊατρικών Επιστημών', 'Biomedical Sciences', 'Βιοϊατρικές Επιστήμες', 'Biomedical Sciences', 4, 9),
  ('uniwa-ot', 'uniwa', 'Εργοθεραπείας', 'Occupational Therapy', 'Εργοθεραπεία', 'Occupational Therapy', 4, 10),
  ('uniwa-midw', 'uniwa', 'Μαιευτικής', 'Midwifery', 'Μαιευτική', 'Midwifery', 4, 11),
  ('uniwa-nurs', 'uniwa', 'Νοσηλευτικής', 'Nursing', 'Νοσηλευτική', 'Nursing', 4, 12),
  ('uniwa-physio', 'uniwa', 'Φυσικοθεραπείας', 'Physiotherapy', 'Φυσικοθεραπεία', 'Physiotherapy', 4, 13),
  ('uniwa-alis', 'uniwa', 'Αρχειονομίας, Βιβλιοθηκονομίας και Συστημάτων Πληροφόρησης', 'Archival, Library and Information Studies', 'Βιβλιοθηκονομία', 'Library Studies', 4, 14),
  ('uniwa-ba', 'uniwa', 'Διοίκησης Επιχειρήσεων', 'Business Administration', 'Διοίκηση Επιχειρήσεων', 'Business', 4, 15),
  ('uniwa-tour', 'uniwa', 'Διοίκησης Τουρισμού', 'Tourism Management', 'Διοίκηση Τουρισμού', 'Tourism', 4, 16),
  ('uniwa-sw', 'uniwa', 'Κοινωνικής Εργασίας', 'Social Work', 'Κοινωνική Εργασία', 'Social Work', 4, 17),
  ('uniwa-accfin', 'uniwa', 'Λογιστικής και Χρηματοοικονομικής', 'Accounting and Finance', 'Λογιστική', 'Accounting', 4, 18),
  ('uniwa-ecec', 'uniwa', 'Αγωγής και Φροντίδας στην Πρώιμη Παιδική Ηλικία', 'Early Childhood Education and Care', 'Πρώιμη Παιδική Ηλικία', 'Early Childhood', 4, 19),
  ('uniwa-php', 'uniwa', 'Πολιτικών Δημόσιας Υγείας', 'Public Health Policies', 'Πολιτικές Δημόσιας Υγείας', 'Public Health Policy', 4, 20),
  ('uniwa-pch', 'uniwa', 'Δημόσιας και Κοινοτικής Υγείας', 'Public and Community Health', 'Δημόσια Υγεία', 'Public Health', 4, 21),
  ('uniwa-fst', 'uniwa', 'Επιστήμης και Τεχνολογίας Τροφίμων', 'Food Science and Technology', 'Τρόφιμα', 'Food Science', 4, 22),
  ('uniwa-wine', 'uniwa', 'Επιστημών Οίνου, Αμπέλου και Ποτών', 'Wine, Vine and Beverage Sciences', 'Οινολογία', 'Wine Sciences', 4, 23),
  ('uniwa-gd', 'uniwa', 'Γραφιστικής και Οπτικής Επικοινωνίας', 'Graphic Design and Visual Communication', 'Γραφιστική', 'Graphic Design', 4, 24),
  ('uniwa-ia', 'uniwa', 'Εσωτερικής Αρχιτεκτονικής', 'Interior Architecture', 'Εσωτερική Αρχιτεκτονική', 'Interior Architecture', 4, 25),
  ('uniwa-cons', 'uniwa', 'Συντήρησης Αρχαιοτήτων και Έργων Τέχνης', 'Conservation of Antiquities and Works of Art', 'Συντήρηση', 'Conservation', 4, 26),
  ('uniwa-photo', 'uniwa', 'Φωτογραφίας και Οπτικοακουστικών Τεχνών', 'Photography and Audiovisual Arts', 'Φωτογραφία', 'Photography', 4, 27),
  -- ΓΠΑ
  ('aua-crop', 'aua', 'Επιστήμης Φυτικής Παραγωγής', 'Crop Science', 'Φυτική Παραγωγή', 'Crop Science', 5, 1),
  ('aua-animal', 'aua', 'Επιστήμης Ζωικής Παραγωγής και Υδατοκαλλιεργειών', 'Animal Science and Aquaculture', 'Ζωική Παραγωγή', 'Animal Science', 5, 2),
  ('aua-nrae', 'aua', 'Αξιοποίησης Φυσικών Πόρων και Γεωργικής Μηχανικής', 'Natural Resources Management and Agricultural Engineering', 'Γεωργική Μηχανική', 'Agricultural Eng.', 5, 3),
  ('aua-food', 'aua', 'Επιστήμης Τροφίμων και Διατροφής του Ανθρώπου', 'Food Science and Human Nutrition', 'Τρόφιμα & Διατροφή', 'Food & Nutrition', 5, 4),
  ('aua-biotech', 'aua', 'Βιοτεχνολογίας', 'Biotechnology', 'Βιοτεχνολογία', 'Biotechnology', 5, 5),
  ('aua-aoa', 'aua', 'Αγροτικής Οικονομίας και Ανάπτυξης', 'Agricultural Economics and Rural Development', 'ΑΟΑ', 'Agri Economics', 5, 6),
  -- Χαροκόπειο
  ('hua-econ', 'hua', 'Οικονομίας και Βιώσιμης Ανάπτυξης', 'Economics and Sustainable Development', 'Βιώσιμη Ανάπτυξη', 'Sustainable Development', 4, 1),
  ('hua-geo', 'hua', 'Γεωγραφίας', 'Geography', 'Γεωγραφία', 'Geography', 4, 2),
  ('hua-diet', 'hua', 'Επιστήμης Διαιτολογίας και Διατροφής', 'Nutrition and Dietetics', 'Διαιτολογία', 'Dietetics', 4, 3),
  ('hua-dit', 'hua', 'Πληροφορικής και Τηλεματικής', 'Informatics and Telematics', 'Πληροφορική', 'Informatics', 4, 4),
  -- ΑΣΚΤ
  ('asfa-fine', 'asfa', 'Εικαστικών Τεχνών', 'Fine Arts', 'Εικαστικές Τέχνες', 'Fine Arts', 5, 1),
  ('asfa-theory', 'asfa', 'Θεωρίας και Ιστορίας της Τέχνης', 'Theory and History of Art', 'Θεωρία της Τέχνης', 'Art Theory', 4, 2),
  -- ΑΣΠΑΙΤΕ
  ('aspete-eee', 'aspete', 'Εκπαιδευτικών Ηλεκτρολόγων Μηχανικών και Εκπαιδευτικών Ηλεκτρονικών Μηχανικών', 'Electrical and Electronic Engineering Educators', 'Ηλεκτρολόγοι & Ηλεκτρονικοί', 'Electrical Educators', 4, 1),
  ('aspete-mech', 'aspete', 'Εκπαιδευτικών Μηχανολόγων Μηχανικών', 'Mechanical Engineering Educators', 'Μηχανολόγοι', 'Mechanical Educators', 4, 2),
  ('aspete-civil', 'aspete', 'Εκπαιδευτικών Πολιτικών Μηχανικών', 'Civil Engineering Educators', 'Πολιτικοί', 'Civil Educators', 4, 3)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Admin: every campus at a glance (students, threshold, open, moderators)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.admin_campuses()
RETURNS TABLE (university_id text, students int, min_students int, is_open boolean, moderators int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT u.id, s.n, u.min_students, s.n >= u.min_students,
         (SELECT count(*)::int FROM private.campus_moderators m WHERE m.university_id = u.id)
  FROM public.universities u,
       LATERAL (SELECT count(*)::int AS n FROM public.profiles p WHERE p.university_id = u.id AND NOT p.disabled) s
  WHERE u.open
  ORDER BY u.position;
END $$;

REVOKE EXECUTE ON FUNCTION private.auto_group_description(text, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_campuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_campuses() TO authenticated;
