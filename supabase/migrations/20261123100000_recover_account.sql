-- User report 2026-11-23: a student whose verified account was made with a personal email (and a password) signed in
-- with a code to his academic address. That made a second, empty account; a password reset then opened that one, and
-- verifying the academic address there answered «already used». claim_student_email now finds the older account in
-- that case: the empty new account is dropped, the older one takes the academic address as its sign-in email, and
-- the app sends a fresh code that opens the right account ('moved').
DO $$ BEGIN
  IF NOT (has_table_privilege('auth.users', 'DELETE') AND has_column_privilege('auth.users', 'email', 'UPDATE')) THEN
    RAISE EXCEPTION 'this role cannot delete users / change their email in the auth schema: not applied';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_student_email() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me_any();
  addr text;
  uni text;
  h text;
  other uuid;
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
  h := private.sha(private.email_key(addr));
  IF EXISTS (SELECT 1 FROM private.banned_emails WHERE email_hash = h) THEN RETURN 'email_taken'; END IF;
  SELECT s.user_id INTO other FROM private.student_emails s WHERE s.email_hash = h AND s.user_id <> uid;
  IF other IS NOT NULL THEN
    -- The address already verifies an older account (e.g. one made with a personal email and a password). Whoever
    -- typed this code controls that mailbox, as its verifier did: hand the older account this address as its sign-in
    -- email and drop the empty account the code sign-in just made, so the next code opens the right account.
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other AND NOT disabled)
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
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND university_id = uni AND student_verified_at IS NOT NULL) THEN
    RETURN 'ok';
  END IF;
  -- Never verified and it had a password: whoever set that password may have planted things. Start clean.
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = uid AND coalesce(encrypted_password, '') <> '')
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND student_verified_at IS NULL) THEN
    DELETE FROM public.follows WHERE uid IN (follower_id, followee_id);
    DELETE FROM public.notifications WHERE uid IN (user_id, actor_id);
    DELETE FROM private.push_tokens WHERE user_id = uid;
    UPDATE public.profiles SET invited_by = NULL, invite_code = NULL WHERE id = uid;
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
