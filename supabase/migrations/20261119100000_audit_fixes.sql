-- Security audit 2026-11.
--
-- 1. A profile's invite code was readable by every student (table-level SELECT), and claiming a code makes the two
--    accounts follow each other = "friends": direct messages, the walkie channel and a friends-only live position.
--    A stranger could read anyone's code and befriend them. The code is now known only to its owner (my_invite())
--    and to whoever they give the link; invited_by is nobody's business either.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, username, full_name, avatar_path, disabled, created_at, university_id, department_id, study_year,
              student_verified_at) ON public.profiles TO authenticated;

-- 2. Anyone can make a password account for an address they do not own (sign-up needs no mailbox access). When the
--    real owner later signed in with the emailed code, that same account became a verified student — and the
--    stranger's password still opened it. The first proof of the mailbox now removes the password and every other
--    session, so only one-time codes open the account from then on.
DO $$ BEGIN
  IF NOT (has_column_privilege('auth.users', 'encrypted_password', 'UPDATE') AND has_table_privilege('auth.sessions', 'DELETE')) THEN
    RAISE EXCEPTION 'this role cannot clear passwords / sessions in the auth schema: not applied';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_student_email() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  UPDATE auth.users SET encrypted_password = NULL WHERE id = uid AND encrypted_password IS NOT NULL;
  DELETE FROM auth.sessions WHERE user_id = uid AND id::text IS DISTINCT FROM (auth.jwt() ->> 'session_id');
  DELETE FROM private.student_emails WHERE user_id = uid;
  INSERT INTO private.student_emails (email_hash, user_id, university_id) VALUES (h, uid, uni);
  UPDATE public.profiles
  SET university_id = uni, student_verified_at = now(),
      department_id = CASE WHEN university_id = uni THEN department_id END,
      study_year = CASE WHEN university_id = uni THEN study_year END
  WHERE id = uid;
  RETURN 'ok';
END $$;
