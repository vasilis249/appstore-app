-- Campus growth + safety (N4).
--   Invites: everyone has an invite link (/i/<code>). A new account (< 7 days) that arrives through it is tied to the
--   inviter and the two follow each other at once (friends → messages and walkie-talkie work right away); the inviter
--   is told. Schools leaderboard: verified students per school of your campus. Campus unlock: a university can be
--   set to open only after N verified students (0 = open; the app shows the waiting progress).
--   Campus moderators: students named by an admin handle the reports on their campus's voices (hide / dismiss only);
--   they see reports without who made them.

-- ---------------------------------------------------------------------------
-- 1. Invites
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN invite_code text UNIQUE CHECK (invite_code ~ '^[a-z0-9]{8}$'),
  ADD COLUMN invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('follow', 'like', 'reply', 'repost', 'report', 'group_invite', 'group_request', 'group_accepted',
                  'group_joined', 'invite_joined'));

-- Your invite code (made the first time) and how many joined with it.
CREATE FUNCTION public.my_invite()
RETURNS TABLE (code text, joined int) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  c text;
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; -- no 0/o, 1/l/i
BEGIN
  SELECT invite_code INTO c FROM public.profiles WHERE id = uid;
  WHILE c IS NULL LOOP
    -- 8 random bytes of a v4 uuid (skipping the version / variant bytes)
    c := (SELECT string_agg(substr(alphabet, 1 + (get_byte(b, (ARRAY[0, 1, 2, 3, 4, 5, 10, 11])[i]) % length(alphabet)), 1), '' ORDER BY i)
          FROM (SELECT uuid_send(gen_random_uuid()) AS b) r, generate_series(1, 8) i);
    BEGIN
      UPDATE public.profiles SET invite_code = c WHERE id = uid;
    EXCEPTION WHEN unique_violation THEN c := NULL;
    END;
  END LOOP;
  RETURN QUERY SELECT c, (SELECT count(*)::int FROM public.profiles WHERE invited_by = uid);
END $$;

-- Who invites (for the public /i/<code> page; the Worker calls it with the service role).
CREATE FUNCTION private.invite_preview(p_code text)
RETURNS TABLE (full_name text, username text, avatar_path text, university_id text, department_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.full_name, p.username, p.avatar_path, p.university_id, p.department_id
  FROM public.profiles p WHERE p.invite_code = lower(btrim(p_code)) AND NOT p.disabled
$$;
CREATE FUNCTION public.invite_preview(p_code text)
RETURNS TABLE (full_name text, username text, avatar_path text, university_id text, department_id text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'authenticated') THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM private.invite_preview(p_code);
END $$;

-- A new account claims the invite it came with: 'ok' | 'already' | 'too_old' | 'self' | 'not_found'.
CREATE FUNCTION public.claim_invite(p_code text)
RETURNS TABLE (status text, inviter_username text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  me public.profiles;
  inviter public.profiles;
BEGIN
  SELECT * INTO me FROM public.profiles WHERE id = uid;
  SELECT * INTO inviter FROM public.profiles WHERE invite_code = lower(btrim(coalesce(p_code, ''))) AND NOT disabled;
  IF NOT FOUND OR private.is_blocked(uid, inviter.id) THEN RETURN QUERY SELECT 'not_found'::text, NULL::text; RETURN; END IF;
  IF inviter.id = uid THEN RETURN QUERY SELECT 'self'::text, inviter.username; RETURN; END IF;
  IF me.invited_by IS NOT NULL THEN RETURN QUERY SELECT 'already'::text, inviter.username; RETURN; END IF;
  IF me.created_at < now() - interval '7 days' THEN RETURN QUERY SELECT 'too_old'::text, inviter.username; RETURN; END IF;
  UPDATE public.profiles SET invited_by = inviter.id WHERE id = uid;
  INSERT INTO public.follows (follower_id, followee_id) VALUES (uid, inviter.id), (inviter.id, uid) ON CONFLICT DO NOTHING;
  PERFORM private.notify(inviter.id, uid, 'invite_joined');
  RETURN QUERY SELECT 'ok'::text, inviter.username;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Schools leaderboard, campus unlock
-- ---------------------------------------------------------------------------
ALTER TABLE public.universities ADD COLUMN min_students int NOT NULL DEFAULT 0 CHECK (min_students BETWEEN 0 AND 100000);

-- Your campus: verified students, how many it needs to open, whether it is open.
CREATE FUNCTION public.campus_status()
RETURNS TABLE (university_id text, students int, min_students int, is_open boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uni text := private.my_university();
BEGIN
  IF uni IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT u.id, s.n, u.min_students, s.n >= u.min_students
  FROM public.universities u,
       LATERAL (SELECT count(*)::int AS n FROM public.profiles p WHERE p.university_id = u.id AND NOT p.disabled) s
  WHERE u.id = uni;
END $$;

-- Every school of your campus: verified students and this week's campus voices by them.
CREATE FUNCTION public.campus_leaderboard()
RETURNS TABLE (department_id text, students int, voices_week int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uni text := private.my_university();
BEGIN
  IF uni IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.id,
         (SELECT count(*)::int FROM public.profiles p WHERE p.department_id = d.id AND NOT p.disabled),
         (SELECT count(*)::int FROM public.posts x JOIN public.profiles a ON a.id = x.author_id
          WHERE x.university_id = uni AND a.department_id = d.id AND x.reply_to IS NULL AND NOT x.hidden
            AND x.created_at > now() - interval '7 days')
  FROM public.departments d
  WHERE d.university_id = uni
  ORDER BY 2 DESC, 3 DESC, d.position;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Campus moderators
-- ---------------------------------------------------------------------------
CREATE TABLE private.campus_moderators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  university_id text NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.campus_moderators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.campus_moderators FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.moderates(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.university_id FROM private.campus_moderators m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.user_id = p_user AND NOT p.disabled
$$;

-- What the app shows you: admin (everything) and/or the campus you moderate.
CREATE FUNCTION public.my_staff_role()
RETURNS TABLE (is_admin boolean, moderates text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_admin(auth.uid()), private.moderates(auth.uid())
$$;

-- Admins: name / remove a campus moderator (by @username); list them; set a campus's unlock threshold.
CREATE FUNCTION public.admin_set_campus_moderator(p_username text, p_university text, p_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  target uuid;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT id INTO target FROM public.profiles WHERE username = lower(btrim(ltrim(p_username, '@')));
  IF target IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_on THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND university_id = p_university) THEN
      RAISE EXCEPTION 'not_student' USING ERRCODE = '22023';
    END IF;
    INSERT INTO private.campus_moderators (user_id, university_id) VALUES (target, p_university)
    ON CONFLICT (user_id) DO UPDATE SET university_id = EXCLUDED.university_id;
  ELSE
    DELETE FROM private.campus_moderators WHERE user_id = target;
  END IF;
END $$;

CREATE FUNCTION public.admin_campus_moderators(p_university text)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_path
  FROM private.campus_moderators m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.university_id = p_university ORDER BY m.created_at;
END $$;

CREATE FUNCTION public.admin_set_campus(p_university text, p_min_students int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.universities SET min_students = greatest(coalesce(p_min_students, 0), 0) WHERE id = p_university;
END $$;

-- May this user act on this report? Admins: all. Moderators: reports on a voice of their campus.
CREATE FUNCTION private.can_moderate_report(p_user uuid, p_report uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_admin(p_user) OR EXISTS (
    SELECT 1 FROM public.reports r JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
    WHERE r.id = p_report AND p.university_id IS NOT NULL AND p.university_id = private.moderates(p_user))
$$;

-- New reports: admins get the notice; so do the moderators of the campus the reported voice is on.
CREATE OR REPLACE FUNCTION private.on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff uuid[];
  uni text;
BEGIN
  IF NEW.kind = 'post' THEN SELECT university_id INTO uni FROM public.posts WHERE id = NEW.target_id; END IF;
  IF NEW.reporter_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT u) INTO staff FROM (
      SELECT a.user_id AS u FROM private.admins a
      UNION SELECT m.user_id FROM private.campus_moderators m WHERE uni IS NOT NULL AND m.university_id = uni
    ) x WHERE u <> NEW.reporter_id;
    DELETE FROM public.notifications n WHERE n.kind = 'report' AND n.user_id = ANY (coalesce(staff, '{}'));
    INSERT INTO public.notifications (user_id, actor_id, kind)
    SELECT u, NEW.reporter_id, 'report' FROM unnest(coalesce(staff, '{}')) u;
  END IF;

  IF NEW.kind = 'post' AND (SELECT count(DISTINCT r.reporter_id) FROM public.reports r
                            WHERE r.kind = 'post' AND r.target_id = NEW.target_id AND r.resolved_at IS NULL) >= 3 THEN
    UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, kind text, reason text, created_at timestamptz, resolved_at timestamptz, action text,
               reporter_username text, target_user_id uuid, target_username text, target_name text,
               target_avatar text, target_disabled boolean, target_is_admin boolean, target_id uuid,
               post_title text, post_audio_path text, post_duration_ms int, post_hidden boolean,
               post_exists boolean, reports_on_target int, group_name text, group_exists boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  admin boolean := private.is_admin(uid);
  mod_uni text := private.moderates(uid);
BEGIN
  IF NOT admin AND mod_uni IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT r.id, r.kind, r.reason, r.created_at, r.resolved_at, r.action,
         CASE WHEN admin THEN rp.username END, u.id, u.username, u.full_name, u.avatar_path, u.disabled,
         private.is_admin(u.id), r.target_id,
         p.title, p.audio_path, p.duration_ms, p.hidden, p.id IS NOT NULL AND p.deleted_at IS NULL,
         (SELECT count(*)::int FROM public.reports o
          WHERE o.resolved_at IS NULL AND o.kind = r.kind
            AND CASE WHEN r.kind IN ('post', 'group') THEN o.target_id = r.target_id ELSE o.target_user_id = r.target_user_id END),
         g.name, g.id IS NOT NULL
  FROM public.reports r
  JOIN public.profiles u ON u.id = r.target_user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
  LEFT JOIN public.groups g ON r.kind = 'group' AND g.id = r.target_id
  WHERE (r.resolved_at IS NULL) = coalesce(p_open, true)
    AND (admin OR (r.kind = 'post' AND p.university_id = mod_uni))
  ORDER BY CASE WHEN coalesce(p_open, true) THEN r.created_at END ASC,
           r.resolved_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

CREATE OR REPLACE FUNCTION public.admin_open_reports()
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  admin boolean := private.is_admin(uid);
  mod_uni text := private.moderates(uid);
BEGIN
  IF NOT admin AND mod_uni IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT count(*)::int FROM public.reports r LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
          WHERE r.resolved_at IS NULL AND (admin OR (r.kind = 'post' AND p.university_id = mod_uni)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report uuid, p_action text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  r public.reports;
  n int;
BEGIN
  IF NOT private.can_moderate_report(uid, p_report) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_action NOT IN ('dismiss', 'hide_post', 'disable_user', 'delete_group')
     OR (p_action = 'hide_post' AND r.kind <> 'post') OR (p_action = 'delete_group' AND r.kind <> 'group') THEN
    RAISE EXCEPTION 'bad_action' USING ERRCODE = '22023';
  END IF;
  -- campus moderators: hide or dismiss only
  IF NOT private.is_admin(uid) AND p_action NOT IN ('dismiss', 'hide_post') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'hide_post' THEN
    UPDATE public.posts SET hidden = true WHERE id = r.target_id;
  ELSIF p_action = 'delete_group' THEN
    DELETE FROM public.groups WHERE id = r.target_id;
  ELSIF p_action = 'disable_user' THEN
    IF private.is_admin(r.target_user_id) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    UPDATE public.profiles SET disabled = true WHERE id = r.target_user_id;
  END IF;

  UPDATE public.reports o SET resolved_at = now(), action = p_action, resolved_by = uid
  WHERE o.resolved_at IS NULL AND (o.id = r.id OR CASE
      WHEN p_action = 'disable_user' THEN o.target_user_id = r.target_user_id
      WHEN r.kind IN ('post', 'group') THEN o.kind = r.kind AND o.target_id = r.target_id
      ELSE o.kind = r.kind AND o.target_user_id = r.target_user_id END);
  GET DIAGNOSTICS n = ROW_COUNT;

  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE resolved_at IS NULL) THEN
    DELETE FROM public.notifications WHERE kind = 'report';
  END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_post_hidden(p_post uuid, p_hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) AND NOT EXISTS (
       SELECT 1 FROM public.posts p WHERE p.id = p_post AND p.university_id IS NOT NULL AND p.university_id = private.moderates(uid)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.posts SET hidden = coalesce(p_hidden, true) WHERE id = p_post;
END $$;

REVOKE EXECUTE ON FUNCTION private.invite_preview(text), private.moderates(uuid), private.can_moderate_report(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.invite_preview(text) TO service_role, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
