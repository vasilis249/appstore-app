-- Security audit 2026-11, part 2 (database findings SD-2 … SD-8, SD-11). Each block says what it closes.

DO $$ BEGIN
  IF NOT has_table_privilege('auth.sessions', 'SELECT') THEN
    RAISE EXCEPTION 'this role cannot read auth.sessions: not applied';
  END IF;
END $$;

-- SD-2 (a) A token whose session was revoked (first code sign-in, sign-out, ban) is refused by every RPC.
CREATE OR REPLACE FUNCTION private.me_any() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND NOT disabled)
     OR (auth.jwt() ? 'session_id'
         AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id::text = auth.jwt() ->> 'session_id')) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN uid;
END $$;

-- SD-2 (b) + SD-6: first proof of the mailbox on an account that had a password = start clean; + tags are one mailbox;
-- an address whose account was banned stays out.
CREATE TABLE IF NOT EXISTS private.banned_emails (email_hash text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.banned_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.email_key(p_email text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT regexp_replace(lower(btrim(p_email)), '\+[^@]*@', '@')
$$;

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
  h := private.sha(private.email_key(addr));
  IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = h AND user_id <> uid)
     OR EXISTS (SELECT 1 FROM private.banned_emails WHERE email_hash = h) THEN RETURN 'email_taken'; END IF;
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

-- a banned account that deletes itself leaves its address hash behind
CREATE OR REPLACE FUNCTION private.keep_banned_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.disabled THEN
    INSERT INTO private.banned_emails (email_hash)
    SELECT email_hash FROM private.student_emails WHERE user_id = OLD.id ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS profile_keep_banned_email ON public.profiles;
CREATE TRIGGER profile_keep_banned_email BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.keep_banned_email();
REVOKE ALL ON FUNCTION private.keep_banned_email(), private.email_key(text) FROM PUBLIC, anon, authenticated;

-- SD-3 uploads: verified students only (also stops banned accounts)
DROP POLICY IF EXISTS voices_upload_own ON storage.objects;
DROP POLICY IF EXISTS avatars_upload_own ON storage.objects;
DROP POLICY IF EXISTS dm_photos_upload_own ON storage.objects;
DROP POLICY IF EXISTS course_files_upload_own ON storage.objects;
CREATE POLICY voices_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voices' AND (storage.foldername(name))[1] = auth.uid()::text AND private.is_student(auth.uid()));
CREATE POLICY avatars_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text AND private.is_student(auth.uid()));
CREATE POLICY dm_photos_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dm-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND private.is_student(auth.uid()));
CREATE POLICY course_files_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files' AND (storage.foldername(name))[1] = auth.uid()::text AND private.is_student(auth.uid()));
-- a banned account keeps reading its own row but no longer edits it
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND NOT disabled)
  WITH CHECK (id = auth.uid() AND (avatar_path IS NULL OR avatar_path LIKE auth.uid()::text || '/%'));

-- SD-4 the map: a position that jumps (or appears from nowhere) more than 6 times an hour is refused
CREATE OR REPLACE FUNCTION public.update_my_location(p_lat double precision, p_lng double precision, p_accuracy real DEFAULT NULL,
                                                     p_heading real DEFAULT NULL, p_speed real DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  prev private.user_locations;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad_location' USING ERRCODE = '22023';
  END IF;
  IF coalesce((SELECT mode FROM public.location_sharing WHERE user_id = uid), 'off') = 'off' THEN RETURN false; END IF;
  SELECT * INTO prev FROM private.user_locations WHERE user_id = uid;
  IF FOUND AND prev.updated_at >= now() - interval '3 seconds' THEN RETURN true; END IF;
  -- first fix, or faster than 250 km/h (and more than 2 km): a real phone does this a few times a day at most
  IF NOT FOUND OR private.distance_m(prev.lat, prev.lng, p_lat, p_lng)
                  > greatest(2000, 70 * extract(epoch FROM now() - prev.updated_at)) THEN
    PERFORM private.rate_limit('location_jump', 6, interval '1 hour');
  END IF;
  INSERT INTO private.user_locations AS l (user_id, lat, lng, accuracy_m, heading, speed, updated_at)
  VALUES (uid, p_lat, p_lng, p_accuracy, p_heading, p_speed, now())
  ON CONFLICT (user_id) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy_m = EXCLUDED.accuracy_m, heading = EXCLUDED.heading,
        speed = EXCLUDED.speed, updated_at = now();
  RETURN true;
END $$;

-- SD-5 reports: staff's "this is fine" shows the post again and switches the automatic hiding off for it
CREATE OR REPLACE FUNCTION private.on_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff uuid[];
  uni text := private.report_university(NEW.kind, NEW.target_id);
BEGIN
  IF NEW.reporter_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT u) INTO staff FROM (
      SELECT a.user_id AS u FROM private.admins a
      UNION SELECT m.user_id FROM private.campus_moderators m WHERE uni IS NOT NULL AND m.university_id = uni
    ) x WHERE u <> NEW.reporter_id;
    DELETE FROM public.notifications n WHERE n.kind = 'report' AND n.user_id = ANY (coalesce(staff, '{}'));
    INSERT INTO public.notifications (user_id, actor_id, kind)
    SELECT u, NEW.reporter_id, 'report' FROM unnest(coalesce(staff, '{}')) u;
  END IF;
  IF NEW.kind IN ('post', 'course_file')
     AND NOT EXISTS (SELECT 1 FROM public.reports d WHERE d.kind = NEW.kind AND d.target_id = NEW.target_id AND d.action = 'dismiss')
     AND (SELECT count(DISTINCT r.reporter_id) FROM public.reports r
          WHERE r.kind = NEW.kind AND r.target_id = NEW.target_id AND r.resolved_at IS NULL) >= 3 THEN
    IF NEW.kind = 'post' THEN UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
    ELSE UPDATE public.course_files SET hidden = true WHERE id = NEW.target_id; END IF;
  END IF;
  RETURN NEW;
END $$;
-- dismissing reports about a post shows it again (it already did for course files); patched in place
DO $$
DECLARE def text := pg_get_functiondef('public.admin_resolve_report(uuid, text)'::regprocedure);
        needle text := 'ELSIF p_action = ''dismiss'' AND r.kind = ''course_file'' THEN';
BEGIN
  IF position(needle IN def) = 0 THEN RAISE EXCEPTION 'admin_resolve_report changed: patch by hand'; END IF;
  EXECUTE replace(def, needle,
    'ELSIF p_action = ''dismiss'' AND r.kind = ''post'' THEN
    UPDATE public.posts SET hidden = false WHERE id = r.target_id;
  ' || needle);
END $$;
-- the code flow (/student) hashes the same way and respects bans
DO $$
DECLARE def text := pg_get_functiondef('private.student_code_issue(uuid, text, text)'::regprocedure);
        needle text := 'private.sha(lower(btrim(p_email)))';
        needle2 text := 'IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = h AND user_id <> p_user) THEN';
BEGIN
  IF position(needle IN def) = 0 OR position(needle2 IN def) = 0 THEN RAISE EXCEPTION 'student_code_issue changed: patch by hand'; END IF;
  EXECUTE replace(replace(def, needle, 'private.sha(private.email_key(p_email))'), needle2,
    'IF EXISTS (SELECT 1 FROM private.student_emails WHERE email_hash = h AND user_id <> p_user)
     OR EXISTS (SELECT 1 FROM private.banned_emails WHERE email_hash = h) THEN');
END $$;

-- SD-7 no e-mail in usernames: the local part of an academic address is often the registry number
CREATE OR REPLACE FUNCTION private.create_profile(p_id uuid, p_email text, p_meta jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base text;
  candidate text;
  tries int := 0;
BEGIN
  base := private.slugify(coalesce(nullif(p_meta ->> 'username', ''), nullif(p_meta ->> 'full_name', ''),
                                   'user' || substr(md5(random()::text), 1, 8)));
  IF char_length(base) < 3 THEN base := 'user' || base; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    tries := tries + 1;
    candidate := CASE WHEN tries < 20 THEN left(base, 16) || (1000 + floor(random() * 9000))::int::text
                      ELSE 'user' || substr(md5(random()::text), 1, 12) END;
  END LOOP;
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (p_id, candidate, left(coalesce(p_meta ->> 'full_name', ''), 60))
  ON CONFLICT (id) DO NOTHING;
END $$;

-- …and the first real name (step 3 of the sign-up) turns that placeholder into a readable username
CREATE OR REPLACE FUNCTION private.name_username() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base text := private.slugify(NEW.full_name);
  candidate text := base;
  tries int := 0;
BEGIN
  IF char_length(base) < 3 THEN RETURN NEW; END IF;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    tries := tries + 1;
    IF tries > 20 THEN RETURN NEW; END IF;
    candidate := left(base, 16) || (1000 + floor(random() * 9000))::int::text;
  END LOOP;
  NEW.username := candidate;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_name_username ON public.profiles;
CREATE TRIGGER profile_name_username BEFORE UPDATE OF full_name ON public.profiles
  FOR EACH ROW WHEN (OLD.username ~ '^user[0-9a-f]{8}$' AND NEW.username = OLD.username
                     AND coalesce(OLD.full_name, '') = '' AND coalesce(NEW.full_name, '') <> '')
  EXECUTE FUNCTION private.name_username();
REVOKE ALL ON FUNCTION private.name_username() FROM PUBLIC, anon, authenticated;

-- SD-8 nobody needs the whole follow graph or other campuses' school groups (the app reads neither)
DROP POLICY IF EXISTS follows_select ON public.follows;
CREATE POLICY follows_select ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() IN (follower_id, followee_id));
DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
  USING (private.is_student(auth.uid())
         AND (NOT auto OR university_id = private.my_university() OR private.is_admin(auth.uid())));

-- Low: TRUNCATE / write grants nobody uses
REVOKE ALL ON public.courses, public.course_files, public.course_file_downloads, public.course_file_thanks,
              public.course_takers, public.groups, public.group_members, public.group_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT UPDATE (username, full_name, avatar_path) ON public.profiles TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
