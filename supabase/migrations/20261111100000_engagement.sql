-- Engagement (user request 2026-10-22): reasons to upload and to come back.
--   1. Downloads and «Ευχαριστώ» per course file; the uploader hears about it (thanks at once, a weekly
--      "your notes helped N classmates"). 2. «Το δίνω»: students mark the courses they take this exam period and hear
--      about new files there; courses show how many take them. 3. Points (10 per file, 1 per classmate who downloaded,
--      3 per thanks), a top-helpers board per department and badges (founding member = first 50 verified students of a
--      department, top helper = top 3). 4. Push: device tokens + a dispatch hook that asks an Edge Function to send every
--      new notification / DM through APNs (inactive until private.push_config holds the function's URL and secret).

-- ---------------------------------------------------------------------------
-- 1. Downloads and thanks
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_files ADD COLUMN downloads_count int NOT NULL DEFAULT 0,
                                ADD COLUMN thanks_count int NOT NULL DEFAULT 0;

-- first download per classmate (the uploader's own opens don't count)
CREATE TABLE public.course_file_downloads (
  file_id uuid NOT NULL REFERENCES public.course_files (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (file_id, user_id)
);
CREATE INDEX course_file_downloads_recent ON public.course_file_downloads (created_at);
CREATE TABLE public.course_file_thanks (
  file_id uuid NOT NULL REFERENCES public.course_files (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (file_id, user_id)
);
CREATE INDEX course_file_thanks_user ON public.course_file_thanks (user_id);
ALTER TABLE public.course_file_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_file_thanks ENABLE ROW LEVEL SECURITY;
-- you see which files you thanked; writes only through the RPCs
CREATE POLICY course_file_thanks_own ON public.course_file_thanks FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION private.course_file_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
BEGIN
  IF TG_TABLE_NAME = 'course_file_downloads' THEN
    UPDATE public.course_files SET downloads_count = greatest(downloads_count + d, 0)
    WHERE id = coalesce(NEW.file_id, OLD.file_id);
  ELSE
    UPDATE public.course_files SET thanks_count = greatest(thanks_count + d, 0)
    WHERE id = coalesce(NEW.file_id, OLD.file_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER course_file_downloads_count AFTER INSERT OR DELETE ON public.course_file_downloads
  FOR EACH ROW EXECUTE FUNCTION private.course_file_counter();
CREATE TRIGGER course_file_thanks_count AFTER INSERT OR DELETE ON public.course_file_thanks
  FOR EACH ROW EXECUTE FUNCTION private.course_file_counter();

-- notifications about course files
ALTER TABLE public.notifications
  ADD COLUMN course_id uuid REFERENCES public.courses (id) ON DELETE CASCADE,
  ADD COLUMN file_id uuid REFERENCES public.course_files (id) ON DELETE CASCADE,
  ADD COLUMN count int;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'follow', 'like', 'reply', 'repost', 'report', 'group_invite', 'group_request', 'group_accepted', 'group_joined',
  'invite_joined', 'walkie', 'nearby', 'file_thanks', 'files_helped', 'course_file'));

-- Opening a classmate's file counts once per person.
CREATE FUNCTION public.record_course_download(p_file uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  f public.course_files;
BEGIN
  SELECT * INTO f FROM public.course_files WHERE id = p_file;
  IF NOT FOUND OR NOT private.can_see_course_file(uid, f.course_id, f.uploader_id, f.hidden) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF f.uploader_id = uid THEN RETURN; END IF;
  INSERT INTO public.course_file_downloads (file_id, user_id) VALUES (p_file, uid) ON CONFLICT DO NOTHING;
END $$;

-- «Ευχαριστώ» on / off; returns the file's thanks count. The uploader gets one notice per classmate and file.
CREATE FUNCTION public.thank_course_file(p_file uuid, p_on boolean DEFAULT true)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  f public.course_files;
BEGIN
  SELECT * INTO f FROM public.course_files WHERE id = p_file;
  IF NOT FOUND OR f.uploader_id = uid OR NOT private.can_see_course_file(uid, f.course_id, f.uploader_id, f.hidden) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(p_on, true) THEN
    PERFORM private.rate_limit('file_thanks', 120, interval '1 hour');
    INSERT INTO public.course_file_thanks (file_id, user_id) VALUES (p_file, uid) ON CONFLICT DO NOTHING;
    IF FOUND AND NOT private.is_blocked(f.uploader_id, uid) THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, course_id, file_id)
      VALUES (f.uploader_id, uid, 'file_thanks', f.course_id, p_file);
    END IF;
  ELSE
    DELETE FROM public.course_file_thanks WHERE file_id = p_file AND user_id = uid;
    DELETE FROM public.notifications WHERE user_id = f.uploader_id AND actor_id = uid AND kind = 'file_thanks' AND file_id = p_file;
  END IF;
  RETURN (SELECT thanks_count FROM public.course_files WHERE id = p_file);
END $$;

-- Weekly (cron, Sunday evening): "N classmates downloaded your files this week", from the latest of them.
CREATE FUNCTION private.weekly_helped()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  WITH h AS (
    SELECT f.uploader_id AS u, count(DISTINCT d.user_id)::int AS n,
           (array_agg(d.user_id ORDER BY d.created_at DESC))[1] AS last
    FROM public.course_file_downloads d JOIN public.course_files f ON f.id = d.file_id
    WHERE d.created_at > now() - interval '7 days' AND NOT f.hidden
    GROUP BY f.uploader_id
  ), old AS (
    DELETE FROM public.notifications o USING h WHERE o.user_id = h.u AND o.kind = 'files_helped'
  )
  INSERT INTO public.notifications (user_id, actor_id, kind, count) SELECT u, last, 'files_helped', h.n FROM h;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION private.weekly_helped() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. «Το δίνω»
-- ---------------------------------------------------------------------------
ALTER TABLE public.courses ADD COLUMN takers_count int NOT NULL DEFAULT 0;
CREATE TABLE public.course_takers (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
CREATE INDEX course_takers_course ON public.course_takers (course_id);
ALTER TABLE public.course_takers ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_takers_own ON public.course_takers FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION private.course_takers_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.courses SET takers_count = greatest(takers_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END, 0)
  WHERE id = coalesce(NEW.course_id, OLD.course_id);
  RETURN NULL;
END $$;
CREATE TRIGGER course_takers_count AFTER INSERT OR DELETE ON public.course_takers
  FOR EACH ROW EXECUTE FUNCTION private.course_takers_counter();

-- Mark / unmark a course of your university (≤ 20); returns how many take it.
CREATE FUNCTION public.set_taking_course(p_course uuid, p_on boolean DEFAULT true)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course AND university_id = private.my_university()) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(p_on, true) THEN
    IF NOT EXISTS (SELECT 1 FROM public.course_takers WHERE user_id = uid AND course_id = p_course)
       AND (SELECT count(*) FROM public.course_takers WHERE user_id = uid) >= 20 THEN
      RAISE EXCEPTION 'too_many_courses' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.course_takers (user_id, course_id) VALUES (uid, p_course) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.course_takers WHERE user_id = uid AND course_id = p_course;
    DELETE FROM public.notifications WHERE user_id = uid AND kind = 'course_file' AND course_id = p_course;
  END IF;
  RETURN (SELECT takers_count FROM public.courses WHERE id = p_course);
END $$;

-- A new file tells everyone who takes the course: one unread notice per course, counting the new files.
CREATE FUNCTION private.on_course_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.hidden THEN RETURN NULL; END IF;
  WITH t AS (
    SELECT k.user_id FROM public.course_takers k
    WHERE k.course_id = NEW.course_id AND k.user_id <> NEW.uploader_id AND NOT private.is_blocked(k.user_id, NEW.uploader_id)
  ), prev AS (
    DELETE FROM public.notifications n USING t
    WHERE n.user_id = t.user_id AND n.kind = 'course_file' AND n.course_id = NEW.course_id AND n.read_at IS NULL
    RETURNING n.user_id, n.count
  )
  INSERT INTO public.notifications (user_id, actor_id, kind, course_id, file_id, count)
  SELECT t.user_id, NEW.uploader_id, 'course_file', NEW.course_id, NEW.id, 1 + coalesce(max(prev.count), 0)
  FROM t LEFT JOIN prev ON prev.user_id = t.user_id GROUP BY t.user_id;
  RETURN NULL;
END $$;
CREATE TRIGGER course_file_notify AFTER INSERT ON public.course_files
  FOR EACH ROW EXECUTE FUNCTION private.on_course_file();

-- ---------------------------------------------------------------------------
-- 3. Points, top helpers, badges
-- ---------------------------------------------------------------------------
-- points per student of a department (visible files only)
CREATE FUNCTION private.department_points(p_department text)
RETURNS TABLE (user_id uuid, points int, files int, downloads int, thanks int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, (count(f.id) * 10 + sum(f.downloads_count) + 3 * sum(f.thanks_count))::int,
         count(f.id)::int, sum(f.downloads_count)::int, sum(f.thanks_count)::int
  FROM public.profiles p JOIN public.course_files f ON f.uploader_id = p.id AND NOT f.hidden
  WHERE p.department_id = p_department AND p.student_verified_at IS NOT NULL AND NOT p.disabled
  GROUP BY p.id
$$;
REVOKE EXECUTE ON FUNCTION private.department_points(text) FROM PUBLIC, anon, authenticated;

-- Top helpers of a department of your university (default: yours).
CREATE FUNCTION public.top_helpers(p_department text DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_path text, study_year smallint,
               points int, files int, downloads int, thanks int, rank int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  dep text := coalesce(p_department, (SELECT department_id FROM public.profiles WHERE id = uid));
BEGIN
  IF dep IS NULL OR NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = dep AND d.university_id = private.my_university()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.user_id, p.username, p.full_name, p.avatar_path, p.study_year, s.points, s.files, s.downloads, s.thanks,
         (rank() OVER (ORDER BY s.points DESC))::int
  FROM private.department_points(dep) s JOIN public.profiles p ON p.id = s.user_id
  WHERE NOT private.is_blocked(uid, s.user_id)
  ORDER BY s.points DESC, s.files DESC, p.full_name
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
END $$;

-- A student's points, place in their department and badges (students of the same university only).
CREATE FUNCTION public.helper_stats(p_user uuid)
RETURNS TABLE (points int, files int, downloads int, thanks int, rank int, founding boolean, top boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  p public.profiles;
  s record;
  r int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user;
  IF NOT FOUND OR p.disabled OR p.student_verified_at IS NULL OR p.department_id IS NULL
     OR (p_user <> uid AND (p.university_id IS DISTINCT FROM private.my_university() OR private.is_blocked(uid, p_user))) THEN
    RETURN;
  END IF;
  SELECT * INTO s FROM private.department_points(p.department_id) x WHERE x.user_id = p_user;
  IF s.points IS NOT NULL THEN
    SELECT count(*)::int + 1 INTO r FROM private.department_points(p.department_id) x WHERE x.points > s.points;
  END IF;
  RETURN QUERY SELECT coalesce(s.points, 0), coalesce(s.files, 0), coalesce(s.downloads, 0), coalesce(s.thanks, 0), r,
    (SELECT count(*) < 50 FROM public.profiles q
     WHERE q.department_id = p.department_id AND q.student_verified_at < p.student_verified_at),
    coalesce(r <= 3 AND s.points >= 10, false);
END $$;

-- ---------------------------------------------------------------------------
-- 4. Push (APNs through the Edge Function `push`)
-- ---------------------------------------------------------------------------
CREATE TABLE private.push_tokens (
  token text PRIMARY KEY CHECK (token ~ '^[0-9a-f]{32,200}$'),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lang text NOT NULL DEFAULT 'el' CHECK (lang IN ('el', 'en')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user ON private.push_tokens (user_id);
-- one row: the function's URL and the shared secret it checks (set on the hosted project only)
CREATE TABLE private.push_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  url text NOT NULL,
  secret text NOT NULL
);

-- This device's APNs token now belongs to you (≤ 10 devices).
CREATE FUNCTION public.register_push_token(p_token text, p_lang text DEFAULT 'el')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32,200}$' THEN RAISE EXCEPTION 'bad_token' USING ERRCODE = '22023'; END IF;
  INSERT INTO private.push_tokens (token, user_id, lang) VALUES (p_token, uid, CASE WHEN p_lang = 'en' THEN 'en' ELSE 'el' END)
  ON CONFLICT (token) DO UPDATE SET user_id = uid, lang = EXCLUDED.lang, updated_at = now();
  DELETE FROM private.push_tokens WHERE user_id = uid AND token NOT IN (
    SELECT token FROM private.push_tokens WHERE user_id = uid ORDER BY updated_at DESC LIMIT 10);
END $$;

-- Signing out: this device stops getting your notifications.
CREATE FUNCTION public.unregister_push_token(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM private.push_tokens WHERE token = p_token AND user_id = auth.uid()
$$;

-- What to send for a new notification ('n', id) or DM ('dm', id): one row per device of the recipient.
CREATE FUNCTION private.push_job(p_kind text, p_id text)
RETURNS TABLE (token text, title text, body text, route text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  n public.notifications;
  m public.voice_messages;
  a public.profiles;
  who uuid;
  name text;
  post_title text;
  group_name text;
  course_name text;
  file_title text;
BEGIN
  IF p_kind = 'n' THEN
    SELECT * INTO n FROM public.notifications WHERE id = p_id::bigint AND read_at IS NULL;
    IF NOT FOUND THEN RETURN; END IF;
    who := n.user_id;
    SELECT * INTO a FROM public.profiles WHERE id = n.actor_id;
    SELECT x.title INTO post_title FROM public.posts x WHERE x.id = n.post_id;
    SELECT x.name INTO group_name FROM public.groups x WHERE x.id = n.group_id;
    SELECT x.name INTO course_name FROM public.courses x WHERE x.id = n.course_id;
    SELECT x.title INTO file_title FROM public.course_files x WHERE x.id = n.file_id;
  ELSIF p_kind = 'dm' THEN
    SELECT * INTO m FROM public.voice_messages WHERE id = p_id::uuid;
    IF NOT FOUND THEN RETURN; END IF;
    who := m.recipient_id;
    SELECT * INTO a FROM public.profiles WHERE id = m.sender_id;
  ELSE
    RETURN;
  END IF;
  name := coalesce(nullif(a.full_name, ''), a.username, 'Speak');
  post_title := left(post_title, 100);
  RETURN QUERY
  SELECT t.token, x.title, x.body, x.route
  FROM private.push_tokens t
  CROSS JOIN LATERAL (SELECT t.lang = 'en' AS en) l
  CROSS JOIN LATERAL (SELECT * FROM (VALUES (
    CASE WHEN p_kind = 'dm' THEN name
         WHEN n.kind = 'files_helped' THEN 'Speak'
         WHEN n.kind = 'course_file' THEN course_name
         WHEN n.kind = 'report' THEN 'Speak'
         ELSE name END,
    CASE
      WHEN p_kind = 'dm' THEN CASE WHEN m.duration_ms IS NOT NULL THEN CASE WHEN l.en THEN '🎤 Voice message' ELSE '🎤 Φωνητικό μήνυμα' END
                                   WHEN m.image_path IS NOT NULL THEN CASE WHEN l.en THEN '📷 Photo' ELSE '📷 Φωτογραφία' END
                                   ELSE left(m.body, 160) END
      WHEN n.kind = 'follow' THEN CASE WHEN l.en THEN 'started following you' ELSE 'σε ακολουθεί' END
      WHEN n.kind = 'like' THEN concat(CASE WHEN l.en THEN 'liked your post' ELSE 'του άρεσε η ανάρτησή σου' END, ': ' || post_title)
      WHEN n.kind = 'reply' THEN concat(CASE WHEN l.en THEN 'replied to your post' ELSE 'απάντησε στην ανάρτησή σου' END, ': ' || post_title)
      WHEN n.kind = 'repost' THEN CASE WHEN l.en THEN 'reposted your post' ELSE 'αναδημοσίευσε την ανάρτησή σου' END
      WHEN n.kind = 'group_invite' THEN concat(CASE WHEN l.en THEN 'invited you to ' ELSE 'σε προσκάλεσε στην ομάδα ' END, group_name)
      WHEN n.kind = 'group_request' THEN concat(CASE WHEN l.en THEN 'asks to join ' ELSE 'ζητά να μπει στην ομάδα ' END, group_name)
      WHEN n.kind = 'group_accepted' THEN concat(CASE WHEN l.en THEN 'let you into ' ELSE 'σε δέχτηκε στην ομάδα ' END, group_name)
      WHEN n.kind = 'group_joined' THEN concat(CASE WHEN l.en THEN 'joined ' ELSE 'μπήκε στην ομάδα ' END, group_name)
      WHEN n.kind = 'invite_joined' THEN CASE WHEN l.en THEN 'joined Speak with your invite' ELSE 'μπήκε στο Speak με την πρόσκλησή σου' END
      WHEN n.kind = 'walkie' THEN CASE WHEN l.en THEN 'sent you a walkie-talkie message' ELSE 'σου μίλησε στο walkie-talkie' END
      WHEN n.kind = 'nearby' THEN CASE WHEN l.en THEN 'talked to you from the map' ELSE 'σου μίλησε από τον χάρτη' END
      WHEN n.kind = 'report' THEN CASE WHEN l.en THEN 'New reports to review' ELSE 'Νέες αναφορές για έλεγχο' END
      WHEN n.kind = 'file_thanks' THEN concat(CASE WHEN l.en THEN 'thanked you for «' ELSE 'σε ευχαρίστησε για «' END, file_title, '» 🙏')
      WHEN n.kind = 'files_helped' THEN CASE WHEN l.en THEN format('Your files helped %s classmates this week 🎉', n.count)
                                             WHEN n.count = 1 THEN 'Τα αρχεία σου βοήθησαν 1 συμφοιτητή αυτή την εβδομάδα 🎉'
                                             ELSE format('Τα αρχεία σου βοήθησαν %s συμφοιτητές αυτή την εβδομάδα 🎉', n.count) END
      WHEN n.kind = 'course_file' THEN CASE WHEN coalesce(n.count, 1) > 1
                                            THEN format(CASE WHEN l.en THEN '%s new files, latest: %s' ELSE '%s νέα αρχεία, το πιο πρόσφατο: %s' END, n.count, file_title)
                                            ELSE concat(name, CASE WHEN l.en THEN ' uploaded «' ELSE ' ανέβασε «' END, file_title, '»') END
    END,
    CASE
      WHEN p_kind = 'dm' THEN '/messages/' || m.sender_id
      WHEN n.kind IN ('follow', 'invite_joined') THEN '/u/' || a.username
      WHEN n.kind IN ('like', 'reply', 'repost') THEN '/p/' || n.post_id
      WHEN n.kind LIKE 'group\_%' THEN '/g/' || n.group_id
      WHEN n.kind = 'walkie' THEN '/talk/' || n.actor_id
      WHEN n.kind = 'nearby' THEN '/map?u=' || n.actor_id
      WHEN n.kind = 'report' THEN '/admin/reports'
      WHEN n.kind IN ('file_thanks', 'course_file') THEN '/c/' || n.course_id
      WHEN n.kind = 'files_helped' THEN '/profile'
      ELSE '/notifications'
    END)) v(title, body, route)) x
  WHERE t.user_id = who AND x.body IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION private.push_job(text, text) FROM PUBLIC, anon, authenticated;

-- service role only (the Edge Function)
CREATE FUNCTION public.push_job(p_kind text, p_id text)
RETURNS TABLE (token text, title text, body text, route text) LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM private.push_job(p_kind, p_id);
END $$;
CREATE FUNCTION public.drop_push_token(p_token text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM private.push_tokens WHERE token = p_token;
END $$;
GRANT EXECUTE ON FUNCTION private.push_job(text, text) TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT DELETE, SELECT ON private.push_tokens TO service_role;

-- New notification / DM → ask the function to send it (only when configured and the recipient has a device).
CREATE FUNCTION private.push_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cfg private.push_config;
  who uuid;
BEGIN
  IF TG_TABLE_NAME = 'voice_messages' THEN who := NEW.recipient_id; ELSE who := NEW.user_id; END IF;
  SELECT * INTO cfg FROM private.push_config;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM private.push_tokens WHERE user_id = who) THEN RETURN NULL; END IF;
  BEGIN
    PERFORM net.http_post(
      url := cfg.url,
      body := jsonb_build_object('kind', CASE WHEN TG_TABLE_NAME = 'voice_messages' THEN 'dm' ELSE 'n' END, 'id', NEW.id::text),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
      timeout_milliseconds := 5000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch: %', SQLERRM; -- never lose the notification itself
  END;
  RETURN NULL;
END $$;
CREATE TRIGGER notifications_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION private.push_dispatch();
CREATE TRIGGER voice_messages_push AFTER INSERT ON public.voice_messages
  FOR EACH ROW EXECUTE FUNCTION private.push_dispatch();

REVOKE EXECUTE ON FUNCTION public.record_course_download(uuid), public.thank_course_file(uuid, boolean),
  public.set_taking_course(uuid, boolean), public.top_helpers(text, int), public.helper_stats(uuid),
  public.register_push_token(text, text), public.unregister_push_token(text), public.push_job(text, text),
  public.drop_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_course_download(uuid), public.thank_course_file(uuid, boolean),
  public.set_taking_course(uuid, boolean), public.top_helpers(text, int), public.helper_stats(uuid),
  public.register_push_token(text, text), public.unregister_push_token(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.push_job(text, text), public.drop_push_token(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.push_job(text, text), public.drop_push_token(text) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('files-helped', '7 16 * * 0', 'SELECT private.weekly_helped()'); -- Sunday ~18:00 / 19:00 Athens
  END IF;
END
$cron$;
