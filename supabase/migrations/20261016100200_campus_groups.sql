-- Campus groups and classmates (N3).
--   Every school gets a private group ("ΕΜΠ · ΗΜΜΥ") and every school-year one ("ΕΜΠ · ΗΜΜΥ · 3ο έτος"), made the
--   first time a student of it appears. Students are put in (and taken out of) them by their profile: pick or change
--   school / year → moved; remove your student identity → out. Nobody runs them (no owner): no invites, no requests,
--   no edits; you may leave and come back while you still study there. They don't show in "discover".
--   Suggestions: classmates first (same school and year, then school, then campus), then friends of friends.

ALTER TABLE public.groups
  ADD COLUMN auto boolean NOT NULL DEFAULT false,
  ADD COLUMN university_id text REFERENCES public.universities (id) ON DELETE CASCADE,
  ADD COLUMN department_id text REFERENCES public.departments (id) ON DELETE CASCADE,
  ADD COLUMN study_year smallint CHECK (study_year BETWEEN 1 AND 7),
  ADD CONSTRAINT groups_auto_check CHECK (NOT auto OR (university_id IS NOT NULL AND department_id IS NOT NULL));
CREATE UNIQUE INDEX groups_auto_one ON public.groups (department_id, coalesce(study_year, 0)) WHERE auto;

CREATE FUNCTION private.year_label(p_year int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_year BETWEEN 1 AND 5 THEN p_year || 'ο έτος' WHEN p_year = 6 THEN 'Μεταπτυχιακό'
              WHEN p_year = 7 THEN 'Διδακτορικό' END
$$;

-- The school (p_year NULL) or school-year group, made if missing.
CREATE FUNCTION private.auto_group(p_department text, p_year int)
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
    concat_ws(' · ', u.short_el, d.short_el, private.year_label(p_year)),
    CASE WHEN p_year IS NULL THEN 'Όλοι οι φοιτητές της Σχολής ' || d.name_el || ' του ' || u.short_el || '.'
         ELSE 'Οι φοιτητές της Σχολής ' || d.name_el || ' του ' || u.short_el || ' · ' || private.year_label(p_year) || '.' END,
    'courses', 'private', true, u.id, d.id, p_year)
  ON CONFLICT DO NOTHING
  RETURNING id INTO gid;
  IF gid IS NULL THEN  -- made at the same moment by someone else
    SELECT id INTO gid FROM public.groups WHERE auto AND department_id = p_department AND coalesce(study_year, 0) = coalesce(p_year, 0);
  END IF;
  RETURN gid;
END $$;

-- Put a student in the groups of their school and year, out of the ones that no longer fit.
CREATE FUNCTION private.sync_student_groups(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.group_members m USING public.groups g
  WHERE m.group_id = g.id AND g.auto AND m.user_id = p_user
    AND (p.department_id IS DISTINCT FROM g.department_id OR (g.study_year IS NOT NULL AND g.study_year IS DISTINCT FROM p.study_year));
  IF p.department_id IS NULL OR p.disabled THEN RETURN; END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (private.auto_group(p.department_id, NULL), p_user)
  ON CONFLICT DO NOTHING;
  IF p.study_year IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id) VALUES (private.auto_group(p.department_id, p.study_year), p_user)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE FUNCTION private.profile_campus_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.sync_student_groups(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER profile_campus_changed AFTER UPDATE OF university_id, department_id, study_year, disabled ON public.profiles
  FOR EACH ROW
  WHEN (OLD.university_id IS DISTINCT FROM NEW.university_id OR OLD.department_id IS DISTINCT FROM NEW.department_id
        OR OLD.study_year IS DISTINCT FROM NEW.study_year OR OLD.disabled IS DISTINCT FROM NEW.disabled)
  EXECUTE FUNCTION private.profile_campus_changed();

-- May this user be in this auto group?
CREATE FUNCTION private.fits_auto_group(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g JOIN public.profiles p ON p.id = p_user
    WHERE g.id = p_group AND g.auto AND p.department_id = g.department_id AND NOT p.disabled
      AND (g.study_year IS NULL OR g.study_year = p.study_year))
$$;

-- Joining: an auto group lets in (again) only students it fits, straight away.
CREATE OR REPLACE FUNCTION public.join_group(p_group uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  g public.groups;
  inv public.group_requests;
BEGIN
  SELECT * INTO g FROM public.groups WHERE id = p_group;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF private.group_role(uid, p_group) IS NOT NULL THEN RETURN 'joined'; END IF;
  IF g.auto THEN
    IF NOT private.fits_auto_group(uid, p_group) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.group_members (group_id, user_id) VALUES (p_group, uid);
    RETURN 'joined';
  END IF;
  SELECT * INTO inv FROM public.group_requests WHERE group_id = p_group AND user_id = uid;

  IF g.privacy = 'public' OR inv.kind = 'invite' THEN
    DELETE FROM public.group_requests WHERE group_id = p_group AND user_id = uid;
    INSERT INTO public.group_members (group_id, user_id) VALUES (p_group, uid);
    IF inv.kind = 'invite' THEN PERFORM private.notify_group(inv.invited_by, uid, 'group_joined', p_group); END IF;
    RETURN 'joined';
  END IF;

  IF inv.kind IS NULL THEN
    PERFORM private.rate_limit('group_request', 30, interval '1 hour');
    INSERT INTO public.group_requests (group_id, user_id, kind) VALUES (p_group, uid, 'request');
    PERFORM private.notify_group(m.user_id, uid, 'group_request', p_group)
    FROM public.group_members m WHERE m.group_id = p_group AND m.role IN ('owner', 'admin');
  END IF;
  RETURN 'requested';
END $$;

-- No invites into auto groups (membership follows the school).
CREATE OR REPLACE FUNCTION public.invite_to_group(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF private.group_role(uid, p_group) IS NULL OR EXISTS (SELECT 1 FROM public.groups WHERE id = p_group AND auto) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.are_friends(uid, p_user) THEN RAISE EXCEPTION 'not_friends' USING ERRCODE = '42501'; END IF;
  IF private.group_role(p_user, p_group) IS NOT NULL THEN RETURN; END IF;
  PERFORM private.rate_limit('group_invite', 50, interval '1 hour');
  -- An invite from an admin also approves a pending request.
  IF EXISTS (SELECT 1 FROM public.group_requests WHERE group_id = p_group AND user_id = p_user AND kind = 'request') THEN
    IF private.is_group_admin(uid, p_group) THEN
      DELETE FROM public.group_requests WHERE group_id = p_group AND user_id = p_user;
      INSERT INTO public.group_members (group_id, user_id) VALUES (p_group, p_user);
      PERFORM private.notify_group(p_user, uid, 'group_accepted', p_group);
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.group_requests (group_id, user_id, kind, invited_by) VALUES (p_group, p_user, 'invite', uid)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  IF FOUND THEN PERFORM private.notify_group(p_user, uid, 'group_invite', p_group); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.discover_groups(p_query text DEFAULT NULL, p_section text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (id uuid, name text, description text, section_id text, privacy text, members_count int,
               posts_count int, my_role text, my_pending text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  q text := translate(private.slugify(coalesce(p_query, '')), '._', '');
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.description, g.section_id, g.privacy, g.members_count, g.posts_count,
         private.group_role(uid, g.id), r.kind
  FROM public.groups g
  LEFT JOIN public.group_requests r ON r.group_id = g.id AND r.user_id = uid
  WHERE NOT g.auto AND (p_section IS NULL OR g.section_id = p_section)
    AND (char_length(q) < 2 OR position(q IN translate(private.slugify(g.name), '._', '')) > 0)
  ORDER BY (char_length(q) >= 2 AND starts_with(translate(private.slugify(g.name), '._', ''), q)) DESC,
           g.members_count DESC, g.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
END $$;

DROP FUNCTION public.group_detail(uuid);
CREATE FUNCTION public.group_detail(p_group uuid)
RETURNS TABLE (id uuid, name text, description text, section_id text, privacy text, members_count int,
               posts_count int, created_at timestamptz, my_role text, my_pending text, invited_by_name text,
               pending_requests int, auto boolean, can_join boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.description, g.section_id, g.privacy, g.members_count, g.posts_count, g.created_at,
         private.group_role(uid, g.id), r.kind, ip.full_name,
         CASE WHEN private.is_group_admin(uid, g.id)
              THEN (SELECT count(*)::int FROM public.group_requests q WHERE q.group_id = g.id AND q.kind = 'request')
              ELSE 0 END,
         g.auto,
         CASE WHEN g.auto THEN private.fits_auto_group(uid, g.id) ELSE true END
  FROM public.groups g
  LEFT JOIN public.group_requests r ON r.group_id = g.id AND r.user_id = uid
  LEFT JOIN public.profiles ip ON ip.id = r.invited_by
  WHERE g.id = p_group;
END $$;

-- People to follow: classmates first (same school and year, same school, same campus), then friends of friends,
-- then popular. reason = 'classmate' | 'school' | 'campus' | null.
DROP FUNCTION public.suggested_people(int);
CREATE FUNCTION public.suggested_people(p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, username text, full_name text, avatar_path text, i_follow boolean, follows_me boolean,
               university_id text, department_id text, study_year smallint, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  me public.profiles;
BEGIN
  SELECT * INTO me FROM public.profiles WHERE profiles.id = uid;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_path, false, private.follows(p.id, uid),
         p.university_id, p.department_id, p.study_year,
         CASE WHEN me.department_id IS NOT NULL AND p.department_id = me.department_id AND p.study_year = me.study_year THEN 'classmate'
              WHEN me.department_id IS NOT NULL AND p.department_id = me.department_id THEN 'school'
              WHEN me.university_id IS NOT NULL AND p.university_id = me.university_id THEN 'campus' END
  FROM public.profiles p
  WHERE p.id <> uid AND NOT p.disabled AND NOT private.is_blocked(uid, p.id) AND NOT private.follows(uid, p.id)
  ORDER BY
    CASE WHEN me.department_id IS NOT NULL AND p.department_id = me.department_id AND p.study_year = me.study_year THEN 3
         WHEN me.department_id IS NOT NULL AND p.department_id = me.department_id THEN 2
         WHEN me.university_id IS NOT NULL AND p.university_id = me.university_id THEN 1 ELSE 0 END DESC,
    (SELECT count(*) FROM public.follows f1 JOIN public.follows f2 ON f2.follower_id = f1.followee_id
     WHERE f1.follower_id = uid AND f2.followee_id = p.id) DESC,
    (SELECT count(*) FROM public.follows f WHERE f.followee_id = p.id) DESC,
    p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 30);
END $$;

REVOKE EXECUTE ON FUNCTION private.auto_group(text, int), private.sync_student_groups(uuid), private.profile_campus_changed(),
  private.fits_auto_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
