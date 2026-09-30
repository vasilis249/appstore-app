-- Campus first, starting with NTUA (ΕΜΠ): universities, their schools, and a verified student identity.
--   A student proves they belong to a university with a code sent to their academic address (@ntua.gr or any
--   @<sub>.ntua.gr). The address itself is never stored: only its hash, so one address = one account.
--   The code is made and mailed by the Worker (service role); the app only checks it here.
--   Then the student picks their school and year. Profiles show "ΕΜΠ · ΗΜΜΥ".

CREATE TABLE public.universities (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{2,20}$'),
  name_el text NOT NULL,
  name_en text NOT NULL,
  short_el text NOT NULL,
  short_en text NOT NULL,
  email_domains text[] NOT NULL,    -- an address @<domain> or @<anything>.<domain> belongs to this university
  city text,
  open boolean NOT NULL DEFAULT false, -- verification offered
  position int NOT NULL DEFAULT 0
);
CREATE TABLE public.departments (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{2,40}$'),
  university_id text NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  name_el text NOT NULL,
  name_en text NOT NULL,
  short_el text NOT NULL,
  short_en text NOT NULL,
  years smallint NOT NULL DEFAULT 5 CHECK (years BETWEEN 1 AND 7),
  position int NOT NULL DEFAULT 0
);
CREATE INDEX departments_university ON public.departments (university_id, position);
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY universities_read ON public.universities FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_read ON public.departments FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.universities, public.departments FROM anon, authenticated;

INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES
  ('ntua', 'Εθνικό Μετσόβιο Πολυτεχνείο', 'National Technical University of Athens', 'ΕΜΠ', 'NTUA', ARRAY['ntua.gr'], 'Αθήνα', true, 1);
INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES
  ('ntua-ece', 'ntua', 'Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών', 'Electrical and Computer Engineering', 'ΗΜΜΥ', 'ECE', 5, 1),
  ('ntua-mech', 'ntua', 'Μηχανολόγων Μηχανικών', 'Mechanical Engineering', 'Μηχανολόγοι', 'Mechanical', 5, 2),
  ('ntua-civil', 'ntua', 'Πολιτικών Μηχανικών', 'Civil Engineering', 'Πολιτικοί', 'Civil', 5, 3),
  ('ntua-chem', 'ntua', 'Χημικών Μηχανικών', 'Chemical Engineering', 'Χημικοί Μηχανικοί', 'Chemical', 5, 4),
  ('ntua-arch', 'ntua', 'Αρχιτεκτόνων Μηχανικών', 'Architecture', 'Αρχιτέκτονες', 'Architecture', 5, 5),
  ('ntua-rsge', 'ntua', 'Αγρονόμων και Τοπογράφων Μηχανικών – Μηχανικών Γεωπληροφορικής', 'Rural, Surveying and Geoinformatics Engineering', 'ΑΤΜ', 'Surveying', 5, 6),
  ('ntua-naval', 'ntua', 'Ναυπηγών Μηχανολόγων Μηχανικών', 'Naval Architecture and Marine Engineering', 'Ναυπηγοί', 'Naval', 5, 7),
  ('ntua-mining', 'ntua', 'Μηχανικών Μεταλλείων – Μεταλλουργών', 'Mining and Metallurgical Engineering', 'ΜΜΜ', 'Mining', 5, 8),
  ('ntua-semfe', 'ntua', 'Εφαρμοσμένων Μαθηματικών και Φυσικών Επιστημών', 'Applied Mathematical and Physical Sciences', 'ΣΕΜΦΕ', 'SEMFE', 5, 9);

-- Student identity on the profile (readable like the rest of the profile; written only through the RPCs below —
-- clients may update only username / full_name / avatar_path).
ALTER TABLE public.profiles
  ADD COLUMN university_id text REFERENCES public.universities (id) ON DELETE SET NULL,
  ADD COLUMN department_id text REFERENCES public.departments (id) ON DELETE SET NULL,
  ADD COLUMN study_year smallint CHECK (study_year BETWEEN 1 AND 7), -- 1–5 undergraduate, 6 master's, 7 PhD
  ADD COLUMN student_verified_at timestamptz,
  ADD CONSTRAINT profiles_student_check CHECK (
    (university_id IS NULL) = (student_verified_at IS NULL) AND (department_id IS NULL OR university_id IS NOT NULL));
CREATE INDEX profiles_campus ON public.profiles (university_id, department_id, study_year) WHERE university_id IS NOT NULL;

-- One academic address per account (hash only).
CREATE TABLE private.student_emails (
  email_hash text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  university_id text NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
-- The code waiting to be typed (one per user): 6 digits, 15 minutes, 5 tries.
CREATE TABLE private.student_codes (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_hash text NOT NULL,
  university_id text NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  sends int NOT NULL DEFAULT 1,
  first_sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.student_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.student_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.student_emails, private.student_codes FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.sha(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

-- Which open university an address belongs to (null: none).
CREATE FUNCTION private.university_for_email(p_email text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id
  FROM public.universities u, unnest(u.email_domains) d
  WHERE u.open
    AND lower(btrim(p_email)) ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    AND (split_part(lower(btrim(p_email)), '@', 2) = d OR split_part(lower(btrim(p_email)), '@', 2) LIKE '%.' || d)
  ORDER BY u.position
  LIMIT 1
$$;

-- Worker only: store a new code for this user and address. Returns the university id. Errors: not_academic,
-- email_taken, too_many (5 codes / hour per user), daily_limit (300 codes / day overall: free mail plans).
CREATE FUNCTION private.student_code_issue(p_user uuid, p_email text, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uni text := private.university_for_email(p_email);
  h text := private.sha(lower(btrim(p_email)));
  c private.student_codes;
BEGIN
  IF uni IS NULL THEN RAISE EXCEPTION 'not_academic' USING ERRCODE = '22023'; END IF;
  IF p_code !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'bad_code' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND NOT disabled) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = h AND user_id <> p_user) THEN
    RAISE EXCEPTION 'email_taken' USING ERRCODE = '23505';
  END IF;
  IF (SELECT coalesce(sum(sends), 0) FROM private.student_codes WHERE first_sent_at > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'daily_limit' USING ERRCODE = '54000';
  END IF;
  SELECT * INTO c FROM private.student_codes WHERE user_id = p_user FOR UPDATE;
  IF FOUND AND c.first_sent_at > now() - interval '1 hour' AND c.sends >= 5 THEN
    RAISE EXCEPTION 'too_many' USING ERRCODE = '54000';
  END IF;
  INSERT INTO private.student_codes (user_id, email_hash, university_id, code_hash, expires_at)
  VALUES (p_user, h, uni, private.sha(p_code), now() + interval '15 minutes')
  ON CONFLICT (user_id) DO UPDATE SET
    email_hash = EXCLUDED.email_hash, university_id = EXCLUDED.university_id, code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at, attempts = 0,
    sends = CASE WHEN private.student_codes.first_sent_at > now() - interval '1 hour' THEN private.student_codes.sends + 1 ELSE 1 END,
    first_sent_at = CASE WHEN private.student_codes.first_sent_at > now() - interval '1 hour'
                         THEN private.student_codes.first_sent_at ELSE now() END;
  RETURN uni;
END $$;

-- The public name is a guard: only the service role gets through (blanket GRANTs can't open it).
CREATE FUNCTION public.student_code_issue(p_user uuid, p_email text, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN private.student_code_issue(p_user, p_email, p_code);
END $$;

-- The student types the code. Returns 'ok' | 'bad_code' | 'expired' | 'too_many' | 'no_code' | 'email_taken'
-- (a status, not an error, so a wrong try is still counted).
CREATE FUNCTION public.verify_student_code(p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  c private.student_codes;
BEGIN
  SELECT * INTO c FROM private.student_codes WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_code'; END IF;
  IF c.expires_at < now() THEN RETURN 'expired'; END IF;
  IF c.attempts >= 5 THEN RETURN 'too_many'; END IF;
  IF private.sha(btrim(coalesce(p_code, ''))) <> c.code_hash THEN
    UPDATE private.student_codes SET attempts = attempts + 1 WHERE user_id = uid;
    RETURN 'bad_code';
  END IF;
  IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = c.email_hash AND user_id <> uid) THEN
    DELETE FROM private.student_codes WHERE user_id = uid;
    RETURN 'email_taken';
  END IF;
  DELETE FROM private.student_emails WHERE user_id = uid;
  INSERT INTO private.student_emails (email_hash, user_id, university_id) VALUES (c.email_hash, uid, c.university_id);
  UPDATE public.profiles
  SET university_id = c.university_id, student_verified_at = now(),
      department_id = CASE WHEN university_id = c.university_id THEN department_id END,
      study_year = CASE WHEN university_id = c.university_id THEN study_year END
  WHERE id = uid;
  DELETE FROM private.student_codes WHERE user_id = uid;
  RETURN 'ok';
END $$;

-- School and year (verified students; either may be left empty).
CREATE FUNCTION public.set_student_info(p_department text, p_year int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  uni text;
BEGIN
  SELECT university_id INTO uni FROM public.profiles WHERE id = uid;
  IF uni IS NULL THEN RAISE EXCEPTION 'not_verified' USING ERRCODE = '42501'; END IF;
  IF p_department IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.departments WHERE id = p_department AND university_id = uni) THEN
    RAISE EXCEPTION 'bad_department' USING ERRCODE = '22023';
  END IF;
  IF p_year IS NOT NULL AND p_year NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'bad_year' USING ERRCODE = '22023'; END IF;
  UPDATE public.profiles SET department_id = p_department, study_year = p_year WHERE id = uid;
END $$;

-- Remove your student identity (the address hash too).
CREATE FUNCTION public.clear_student_identity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  DELETE FROM private.student_emails WHERE user_id = uid;
  DELETE FROM private.student_codes WHERE user_id = uid;
  UPDATE public.profiles SET university_id = NULL, department_id = NULL, study_year = NULL, student_verified_at = NULL
  WHERE id = uid;
END $$;

REVOKE EXECUTE ON FUNCTION private.student_code_issue(uuid, text, text), private.university_for_email(text), private.sha(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.student_code_issue(uuid, text, text) TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
