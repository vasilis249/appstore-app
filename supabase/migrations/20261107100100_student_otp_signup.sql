-- 3-step sign-up (user decision 2026-10-15): academic email → code → department / year.
-- The account IS the academic address: Supabase Auth mails a one-time code (signInWithOtp), and a session opened with
-- that code proves the address. Then the app calls claim_student_email() and the student is verified without a second
-- code. A password session proves nothing (sign-up still auto-confirms), so it gets 'not_otp' and keeps using the
-- separate student-code flow (verify_student_code) as before.

CREATE FUNCTION public.claim_student_email()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me_any();
  addr text;
  uni text;
  h text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    WHERE a ->> 'method' IN ('otp', 'magiclink', 'email/signup')
  ) THEN
    RETURN 'not_otp';
  END IF;
  SELECT lower(btrim(email)) INTO addr FROM auth.users WHERE id = uid;
  uni := private.university_for_email(addr);
  IF uni IS NULL THEN RETURN 'not_academic'; END IF;
  h := private.sha(addr);
  IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = h AND user_id <> uid) THEN RETURN 'email_taken'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND university_id = uni AND student_verified_at IS NOT NULL) THEN
    RETURN 'ok';
  END IF;
  DELETE FROM private.student_emails WHERE user_id = uid;
  INSERT INTO private.student_emails (email_hash, user_id, university_id) VALUES (h, uid, uni);
  UPDATE public.profiles
  SET university_id = uni, student_verified_at = now(),
      department_id = CASE WHEN university_id = uni THEN department_id END,
      study_year = CASE WHEN university_id = uni THEN study_year END
  WHERE id = uid;
  RETURN 'ok';
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_student_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_student_email() TO authenticated, service_role;

-- The sign-up's first step names the university of the address before there is an account: the list of universities
-- and departments (public names and email domains) is readable without signing in.
CREATE POLICY universities_read_anon ON public.universities FOR SELECT TO anon USING (true);
CREATE POLICY departments_read_anon ON public.departments FOR SELECT TO anon USING (true);
GRANT SELECT ON public.universities, public.departments TO anon;
