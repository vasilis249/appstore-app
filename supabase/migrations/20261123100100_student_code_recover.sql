-- User report 2026-11-23 (smd2200078, again): after his empty second account was deleted he made a new one, and
-- the student screen (/student: academic email → code) still answered «already used» — only the code sign-in
-- (claim_student_email) knew how to find the older account. Now the student screen does the same: the code goes out
-- even when the address verifies another account (the code proves the mailbox), and a correct code moves you there
-- when your current account is empty: it is dropped, the older account takes the address as its sign-in email, and
-- the app sends a sign-in code that opens it ('moved'). Content on the current account, or a banned holder → «already used».
DO $$ BEGIN
  IF NOT (has_table_privilege('auth.users', 'DELETE') AND has_column_privilege('auth.users', 'email', 'UPDATE')) THEN
    RAISE EXCEPTION 'this role cannot delete users / change their email in the auth schema: not applied';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.student_code_issue(p_user uuid, p_email text, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uni text := private.university_for_email(p_email);
  h text := private.sha(private.email_key(p_email));
  c private.student_codes;
BEGIN
  IF uni IS NULL THEN RAISE EXCEPTION 'not_academic' USING ERRCODE = '22023'; END IF;
  IF p_code !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'bad_code' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND NOT disabled) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM private.banned_emails WHERE email_hash = h) THEN
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

-- p_email: the address the code went to (only its hash is stored); needed to make it the older account's sign-in email
DROP FUNCTION IF EXISTS public.verify_student_code(text);
CREATE FUNCTION public.verify_student_code(p_code text, p_email text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me_any();
  c private.student_codes;
  other uuid;
  addr text := lower(btrim(coalesce(p_email, '')));
BEGIN
  SELECT * INTO c FROM private.student_codes WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_code'; END IF;
  IF c.expires_at < now() THEN RETURN 'expired'; END IF;
  IF c.attempts >= 5 THEN RETURN 'too_many'; END IF;
  IF private.sha(btrim(coalesce(p_code, ''))) <> c.code_hash THEN
    UPDATE private.student_codes SET attempts = attempts + 1 WHERE user_id = uid;
    RETURN 'bad_code';
  END IF;
  SELECT s.user_id INTO other FROM private.student_emails s WHERE s.email_hash = c.email_hash AND s.user_id <> uid;
  IF other IS NOT NULL THEN
    DELETE FROM private.student_codes WHERE user_id = uid;
    IF addr = '' OR private.sha(private.email_key(addr)) <> c.email_hash
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other AND NOT disabled)
       OR EXISTS (SELECT 1 FROM public.posts WHERE author_id = uid)
       OR EXISTS (SELECT 1 FROM public.course_files WHERE uploader_id = uid)
       OR EXISTS (SELECT 1 FROM public.voice_messages WHERE sender_id = uid) THEN
      RETURN 'email_taken';
    END IF;
    DELETE FROM auth.users WHERE id = uid;
    UPDATE auth.users SET email = addr, email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = other;
    IF to_regclass('auth.identities') IS NOT NULL THEN
      EXECUTE $q$UPDATE auth.identities SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb($1::text))
                 WHERE user_id = $2 AND provider = 'email'$q$ USING addr, other;
    END IF;
    RETURN 'moved';
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
REVOKE ALL ON FUNCTION public.verify_student_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_student_code(text, text) TO authenticated;
