-- M2 (user request 2026-10-19): every course of a department, and per course notes / past exam papers uploaded by
-- students. The catalog comes from supabase/data/courses/<uni>.json (next migration, generated). Files live in the
-- PRIVATE bucket `course-files` under the uploader's folder; only students of that university read them (signed
-- URLs). Reports work like posts: 3 reporters hide a file, staff dismiss (shown again) or delete it.

CREATE TABLE public.courses (
  id uuid PRIMARY KEY,                       -- md5(department|semester|name): stable across re-imports
  university_id text NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  department_id text NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  code text CHECK (char_length(code) <= 40),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  semester smallint CHECK (semester BETWEEN 1 AND 14), -- NULL = no fixed semester
  kind text NOT NULL CHECK (kind IN ('core', 'track_core', 'elective')),
  groups text[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  files_count int NOT NULL DEFAULT 0
);
CREATE INDEX courses_department ON public.courses (department_id, semester, position);

CREATE TABLE public.course_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('notes', 'exams')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  path text NOT NULL UNIQUE CHECK (char_length(path) <= 200),
  mime text NOT NULL,
  size_bytes int NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_files_course ON public.course_files (course_id, created_at DESC);
CREATE INDEX course_files_uploader ON public.course_files (uploader_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;

-- your university's courses (admins: all); no client writes
CREATE POLICY courses_read ON public.courses FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR (private.is_student(auth.uid()) AND university_id = private.my_university()));

-- May this user see this file? Own, admin, a moderator of that campus, or (not hidden) a student of that university.
CREATE FUNCTION private.can_see_course_file(p_user uuid, p_course uuid, p_uploader uuid, p_hidden boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user IS NOT NULL AND (p_uploader = p_user OR private.is_admin(p_user) OR EXISTS (
    SELECT 1 FROM public.courses c JOIN public.profiles p ON p.id = p_user
    WHERE c.id = p_course AND NOT p.disabled
      AND (c.university_id = private.moderates(p_user)
           OR (NOT p_hidden AND c.university_id = p.university_id
               AND NOT private.is_blocked(p_user, p_uploader)))))
$$;
REVOKE EXECUTE ON FUNCTION private.can_see_course_file(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_see_course_file(uuid, uuid, uuid, boolean) TO authenticated;

CREATE POLICY course_files_read ON public.course_files FOR SELECT TO authenticated
  USING (private.can_see_course_file(auth.uid(), course_id, uploader_id, hidden));

-- visible files per course
CREATE FUNCTION private.course_files_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
BEGIN
  UPDATE public.courses SET files_count =
    (SELECT count(*)::int FROM public.course_files WHERE course_id = cid AND NOT hidden) WHERE id = cid;
  RETURN NULL;
END $$;
CREATE TRIGGER course_files_count AFTER INSERT OR DELETE OR UPDATE OF hidden ON public.course_files
  FOR EACH ROW EXECUTE FUNCTION private.course_files_count();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course-files', 'course-files', false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY course_files_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY course_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY course_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.course_files f WHERE f.path = name
               AND private.can_see_course_file(auth.uid(), f.course_id, f.uploader_id, f.hidden))));

-- A file already uploaded to course-files/<you>/…, on a course of your university.
CREATE FUNCTION public.add_course_file(p_course uuid, p_kind text, p_title text, p_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  obj storage.objects;
  fid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course AND university_id = private.my_university()) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('notes', 'exams') THEN RAISE EXCEPTION 'bad_kind' USING ERRCODE = '22023'; END IF;
  IF v_title IS NULL THEN RAISE EXCEPTION 'empty_post' USING ERRCODE = '22023'; END IF;
  IF char_length(v_title) > 120 THEN RAISE EXCEPTION 'too_long' USING ERRCODE = '22023'; END IF;
  SELECT * INTO obj FROM storage.objects WHERE bucket_id = 'course-files' AND name = p_path;
  IF NOT FOUND OR NOT starts_with(p_path, uid::text || '/') OR char_length(p_path) > 200
     OR EXISTS (SELECT 1 FROM public.course_files WHERE path = p_path) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;
  PERFORM private.rate_limit('course_file', 20, interval '1 hour');
  PERFORM private.rate_limit('course_file_day', 60, interval '1 day');
  INSERT INTO public.course_files (course_id, uploader_id, kind, title, path, mime, size_bytes)
  VALUES (p_course, uid, p_kind, v_title, p_path,
          coalesce(obj.metadata->>'mimetype', CASE WHEN p_path ILIKE '%.pdf' THEN 'application/pdf' ELSE 'image/jpeg' END),
          coalesce((obj.metadata->>'size')::int, 0))
  RETURNING id INTO fid;
  RETURN fid;
END $$;

-- Your own file (the sweeper removes the stored file).
CREATE FUNCTION public.delete_course_file(p_file uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  DELETE FROM public.course_files WHERE id = p_file AND uploader_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
END $$;

-- course-files objects no row points at (deleted files, failed uploads): the sweeper removes them.
CREATE FUNCTION private.orphan_course_files(p_limit int)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'course-files' AND o.created_at < now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.course_files f WHERE f.path = o.name)
  ORDER BY o.created_at
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000)
$$;
REVOKE EXECUTE ON FUNCTION private.orphan_course_files(int) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.orphan_course_files(p_limit int DEFAULT 200)
RETURNS SETOF text LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM private.orphan_course_files(p_limit);
END $$;
GRANT EXECUTE ON FUNCTION private.orphan_course_files(int) TO service_role;

-- ---------------------------------------------------------------------------
-- Reports: kind course_file (target = the uploader), 3 reporters hide it; staff dismiss (shown again) or delete it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT reports_kind_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_kind_check
  CHECK (kind IN ('user', 'voice_message', 'post', 'group', 'course_file'));
ALTER TABLE public.reports DROP CONSTRAINT reports_action_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_action_check
  CHECK (action IN ('dismiss', 'hide_post', 'disable_user', 'delete_group', 'delete_file'));

-- the campus a reported post / file belongs to (moderators see those)
CREATE FUNCTION private.report_university(p_kind text, p_target uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_kind
    WHEN 'post' THEN (SELECT university_id FROM public.posts WHERE id = p_target)
    WHEN 'course_file' THEN (SELECT c.university_id FROM public.course_files f JOIN public.courses c ON c.id = f.course_id
                             WHERE f.id = p_target) END
$$;
REVOKE EXECUTE ON FUNCTION private.report_university(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_content(p_kind text, p_target uuid, p_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  target_user uuid;
BEGIN
  IF p_kind = 'user' THEN
    SELECT id INTO target_user FROM public.profiles WHERE id = p_target;
  ELSIF p_kind = 'voice_message' THEN
    SELECT m.sender_id INTO target_user FROM public.voice_messages m WHERE m.id = p_target AND m.recipient_id = uid;
  ELSIF p_kind = 'post' THEN
    SELECT p.author_id INTO target_user FROM public.posts p
    WHERE p.id = p_target AND (private.can_see_post(p.id) OR private.is_blocked(uid, p.author_id));
  ELSIF p_kind = 'group' THEN
    SELECT m.user_id INTO target_user FROM public.group_members m WHERE m.group_id = p_target AND m.role = 'owner';
  ELSIF p_kind = 'course_file' THEN
    SELECT f.uploader_id INTO target_user FROM public.course_files f
    WHERE f.id = p_target AND private.can_see_course_file(uid, f.course_id, f.uploader_id, f.hidden);
  END IF;
  IF target_user IS NULL OR target_user = uid THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.rate_limit('report', 20, interval '1 hour');
  INSERT INTO public.reports (reporter_id, target_user_id, kind, target_id, reason)
  VALUES (uid, target_user, p_kind, CASE WHEN p_kind = 'user' THEN NULL ELSE p_target END, left(coalesce(p_reason, ''), 500));
END $$;

CREATE OR REPLACE FUNCTION private.on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

  IF NEW.kind IN ('post', 'course_file') AND (SELECT count(DISTINCT r.reporter_id) FROM public.reports r
                            WHERE r.kind = NEW.kind AND r.target_id = NEW.target_id AND r.resolved_at IS NULL) >= 3 THEN
    IF NEW.kind = 'post' THEN UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
    ELSE UPDATE public.course_files SET hidden = true WHERE id = NEW.target_id; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.can_moderate_report(p_user uuid, p_report uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_admin(p_user) OR EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = p_report AND r.kind IN ('post', 'course_file')
      AND private.report_university(r.kind, r.target_id) = private.moderates(p_user))
$$;

DROP FUNCTION public.admin_reports(boolean, int);
CREATE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, kind text, reason text, created_at timestamptz, resolved_at timestamptz, action text,
              reporter_username text, target_user_id uuid, target_username text, target_name text, target_avatar text,
              target_disabled boolean, target_is_admin boolean, target_id uuid, post_title text, post_audio_path text,
              post_duration_ms integer, post_hidden boolean, post_exists boolean, reports_on_target integer,
              group_name text, group_exists boolean, post_images text[],
              file_title text, file_path text, file_hidden boolean, file_exists boolean, course_name text)
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
            AND CASE WHEN r.kind IN ('post', 'group', 'course_file') THEN o.target_id = r.target_id
                     ELSE o.target_user_id = r.target_user_id END),
         g.name, g.id IS NOT NULL, p.images,
         f.title, f.path, f.hidden, f.id IS NOT NULL, c.name
  FROM public.reports r
  JOIN public.profiles u ON u.id = r.target_user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
  LEFT JOIN public.groups g ON r.kind = 'group' AND g.id = r.target_id
  LEFT JOIN public.course_files f ON r.kind = 'course_file' AND f.id = r.target_id
  LEFT JOIN public.courses c ON c.id = f.course_id
  WHERE (r.resolved_at IS NULL) = coalesce(p_open, true)
    AND (admin OR (r.kind = 'post' AND p.university_id = mod_uni) OR (r.kind = 'course_file' AND c.university_id = mod_uni))
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
  RETURN (SELECT count(*)::int FROM public.reports r
          WHERE r.resolved_at IS NULL AND (admin OR (r.kind IN ('post', 'course_file')
                                                     AND private.report_university(r.kind, r.target_id) = mod_uni)));
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
  IF p_action NOT IN ('dismiss', 'hide_post', 'disable_user', 'delete_group', 'delete_file')
     OR (p_action = 'hide_post' AND r.kind <> 'post') OR (p_action = 'delete_group' AND r.kind <> 'group')
     OR (p_action = 'delete_file' AND r.kind <> 'course_file') THEN
    RAISE EXCEPTION 'bad_action' USING ERRCODE = '22023';
  END IF;
  -- campus moderators: hide / delete a file or dismiss only
  IF NOT private.is_admin(uid) AND p_action NOT IN ('dismiss', 'hide_post', 'delete_file') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'hide_post' THEN
    UPDATE public.posts SET hidden = true WHERE id = r.target_id;
  ELSIF p_action = 'delete_group' THEN
    DELETE FROM public.groups WHERE id = r.target_id;
  ELSIF p_action = 'delete_file' THEN
    DELETE FROM public.course_files WHERE id = r.target_id;
  ELSIF p_action = 'dismiss' AND r.kind = 'course_file' THEN
    UPDATE public.course_files SET hidden = false WHERE id = r.target_id; -- hidden by 3 reports, judged fine
  ELSIF p_action = 'disable_user' THEN
    IF private.is_admin(r.target_user_id) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    UPDATE public.profiles SET disabled = true WHERE id = r.target_user_id;
  END IF;

  UPDATE public.reports o SET resolved_at = now(), action = p_action, resolved_by = uid
  WHERE o.resolved_at IS NULL AND (o.id = r.id OR CASE
      WHEN p_action = 'disable_user' THEN o.target_user_id = r.target_user_id
      WHEN r.kind IN ('post', 'group', 'course_file') THEN o.kind = r.kind AND o.target_id = r.target_id
      ELSE o.kind = r.kind AND o.target_user_id = r.target_user_id END);
  GET DIAGNOSTICS n = ROW_COUNT;

  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE resolved_at IS NULL) THEN
    DELETE FROM public.notifications WHERE kind = 'report';
  END IF;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_course_file(uuid, text, text, text), public.delete_course_file(uuid),
  public.orphan_course_files(int), public.admin_reports(boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_course_file(uuid, text, text, text), public.delete_course_file(uuid),
  public.admin_reports(boolean, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orphan_course_files(int) TO service_role;
