-- Admin metrics (product directive O3, user OK 2026-10-23): aggregates per university and department, computed from
-- data Speak already stores (verification time, posts, files, «Το δίνω», groups, messages, follows, likes, listens,
-- downloads, reports). No new tracking, no per-person rows: counts and rates only, for admins only.
--
-- Definitions (also on the admin screen):
--   student      = verified, not disabled.
--   active       = did anything we record (posted, replied, liked, listened, downloaded, uploaded, thanked, took a
--                  course, joined a group they chose, messaged, followed).
--   contributor  = posted / replied or uploaded a file.
--   activated    = a meaningful first action within 7 days of verifying: posted / replied, uploaded, thanked, took a
--                  course, joined a group they chose (auto groups don't count) or messaged someone.
--   week-1 kept  = active again between day 7 and day 14 after verifying.
--   readiness    = O4 proposal, read-only (campuses still open by the 100-registration rule): a department is "ready"
--                  with ≥ 8 students, ≥ 3 active in 7 days and ≥ 3 resources (files + course questions) in 30 days.

CREATE FUNCTION private.student_activity(p_since timestamptz)
RETURNS TABLE (user_id uuid, at timestamptz, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT author_id, created_at, CASE WHEN reply_to IS NULL THEN 'post' ELSE 'reply' END
    FROM public.posts WHERE author_id IS NOT NULL AND NOT plain_repost AND created_at >= p_since
  UNION ALL SELECT uploader_id, created_at, 'file' FROM public.course_files WHERE created_at >= p_since
  UNION ALL SELECT user_id, created_at, 'thanks' FROM public.course_file_thanks WHERE created_at >= p_since
  UNION ALL SELECT user_id, created_at, 'take' FROM public.course_takers WHERE created_at >= p_since
  UNION ALL SELECT m.user_id, m.created_at, 'group' FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
    WHERE NOT g.auto AND m.created_at >= p_since
  UNION ALL SELECT sender_id, created_at, 'message' FROM public.voice_messages WHERE created_at >= p_since
  UNION ALL SELECT follower_id, created_at, 'follow' FROM public.follows WHERE created_at >= p_since
  UNION ALL SELECT user_id, created_at, 'like' FROM public.post_likes WHERE created_at >= p_since
  UNION ALL SELECT user_id, created_at, 'listen' FROM public.post_listens WHERE created_at >= p_since
  UNION ALL SELECT user_id, created_at, 'download' FROM public.course_file_downloads WHERE created_at >= p_since
$$;
REVOKE EXECUTE ON FUNCTION private.student_activity(timestamptz) FROM PUBLIC, anon, authenticated;

-- p_university NULL: one summary row per university with students; else that university's numbers + departments.
CREATE FUNCTION public.admin_metrics(p_university text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ -- temp tables: not STABLE
DECLARE
  uid uuid := private.me();
  result jsonb;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.m_students (id uuid, university_id text, department_id text, v timestamptz, invited boolean) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.m_act (user_id uuid, at timestamptz, kind text) ON COMMIT DROP;
  TRUNCATE pg_temp.m_students, pg_temp.m_act;
  INSERT INTO pg_temp.m_students
    SELECT p.id, p.university_id, p.department_id, p.student_verified_at, p.invited_by IS NOT NULL
    FROM public.profiles p
    WHERE p.student_verified_at IS NOT NULL AND NOT p.disabled AND (p_university IS NULL OR p.university_id = p_university);
  INSERT INTO pg_temp.m_act
    SELECT a.user_id, a.at, a.kind FROM private.student_activity(now() - interval '90 days') a
    WHERE a.user_id IN (SELECT id FROM pg_temp.m_students);

  IF p_university IS NULL THEN
    SELECT coalesce(jsonb_agg(r ORDER BY r.students DESC, r.university_id), '[]') INTO result FROM (
      SELECT s.university_id, count(*)::int AS students,
             count(*) FILTER (WHERE s.v > now() - interval '7 days')::int AS new_7d,
             (SELECT count(DISTINCT a.user_id) FROM pg_temp.m_act a JOIN pg_temp.m_students x ON x.id = a.user_id
               WHERE x.university_id = s.university_id AND a.at > now() - interval '7 days')::int AS active_7d,
             (SELECT count(DISTINCT a.user_id) FROM pg_temp.m_act a JOIN pg_temp.m_students x ON x.id = a.user_id
               WHERE x.university_id = s.university_id AND a.kind IN ('post', 'reply', 'file') AND a.at > now() - interval '30 days')::int AS contributors_30d,
             (SELECT count(*) FROM public.course_files f JOIN public.courses c ON c.id = f.course_id
               WHERE c.university_id = s.university_id AND NOT f.hidden)::int AS files,
             (SELECT count(*) FROM public.posts q WHERE q.university_id = s.university_id AND q.course_id IS NOT NULL
               AND q.deleted_at IS NULL)::int AS questions,
             (SELECT u.min_students FROM public.universities u WHERE u.id = s.university_id) AS min_students
      FROM pg_temp.m_students s GROUP BY s.university_id) r;
    RETURN jsonb_build_object('universities', result);
  END IF;

  WITH q AS (  -- course questions of the last 30 days and their first answer by someone else
    SELECT p.id, p.created_at, p.helpful_reply_id,
           (SELECT min(r.created_at) FROM public.posts r WHERE r.reply_to = p.id AND r.author_id IS DISTINCT FROM p.author_id
              AND r.deleted_at IS NULL) AS first_answer
    FROM public.posts p
    WHERE p.university_id = p_university AND p.course_id IS NOT NULL AND p.deleted_at IS NULL AND p.created_at > now() - interval '30 days'
  ), rep AS (
    SELECT r.created_at, r.resolved_at FROM public.reports r JOIN public.profiles t ON t.id = r.target_user_id
    WHERE t.university_id = p_university AND r.created_at > now() - interval '30 days'
  )
  SELECT jsonb_build_object(
    'students', (SELECT count(*) FROM pg_temp.m_students),
    'new_7d', (SELECT count(*) FROM pg_temp.m_students WHERE v > now() - interval '7 days'),
    'new_30d', (SELECT count(*) FROM pg_temp.m_students WHERE v > now() - interval '30 days'),
    'referred_30d', (SELECT count(*) FROM pg_temp.m_students WHERE v > now() - interval '30 days' AND invited),
    'active_7d', (SELECT count(DISTINCT user_id) FROM pg_temp.m_act WHERE at > now() - interval '7 days'),
    'contributors_30d', (SELECT count(DISTINCT user_id) FROM pg_temp.m_act WHERE kind IN ('post', 'reply', 'file') AND at > now() - interval '30 days'),
    -- of students verified 7–90 days ago (they had their whole first week): share activated in it
    'activation', (SELECT jsonb_build_object('cohort', count(*), 'activated', count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pg_temp.m_act a WHERE a.user_id = s.id AND a.kind IN ('post', 'reply', 'file', 'thanks', 'take', 'group', 'message')
          AND a.at BETWEEN s.v AND s.v + interval '7 days')))
      FROM pg_temp.m_students s WHERE s.v BETWEEN now() - interval '90 days' AND now() - interval '7 days'),
    -- of students verified 14–90 days ago: share active again in days 7–14
    'week1', (SELECT jsonb_build_object('cohort', count(*), 'kept', count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pg_temp.m_act a WHERE a.user_id = s.id AND a.at BETWEEN s.v + interval '7 days' AND s.v + interval '14 days')))
      FROM pg_temp.m_students s WHERE s.v BETWEEN now() - interval '90 days' AND now() - interval '14 days'),
    'courses_taken_by', (SELECT count(DISTINCT k.user_id) FROM public.course_takers k WHERE k.user_id IN (SELECT id FROM pg_temp.m_students)),
    'files_30d', (SELECT count(*) FROM pg_temp.m_act WHERE kind = 'file' AND at > now() - interval '30 days'),
    'downloads_30d', (SELECT count(*) FROM pg_temp.m_act WHERE kind = 'download' AND at > now() - interval '30 days'),
    'thanks_30d', (SELECT count(*) FROM pg_temp.m_act WHERE kind = 'thanks' AND at > now() - interval '30 days'),
    'posts_30d', (SELECT count(*) FROM pg_temp.m_act WHERE kind = 'post' AND at > now() - interval '30 days'),
    'questions_30d', (SELECT count(*) FROM q),
    'questions_answered', (SELECT count(*) FROM q WHERE first_answer IS NOT NULL),
    'questions_helpful', (SELECT count(*) FROM q WHERE helpful_reply_id IS NOT NULL),
    'first_answer_hours', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_answer - created_at)) / 3600)::numeric, 1)
                           FROM q WHERE first_answer IS NOT NULL),
    'reports_30d', (SELECT count(*) FROM rep),
    'reports_open', (SELECT count(*) FROM public.reports r JOIN public.profiles t ON t.id = r.target_user_id
                     WHERE t.university_id = p_university AND r.resolved_at IS NULL),
    'report_hours', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at)) / 3600)::numeric, 1)
                     FROM rep WHERE resolved_at IS NOT NULL),
    'departments', (SELECT coalesce(jsonb_agg(d ORDER BY d.students DESC, d.department_id), '[]') FROM (
      SELECT s.department_id, count(*)::int AS students,
             count(*) FILTER (WHERE s.v > now() - interval '30 days')::int AS new_30d,
             (SELECT count(DISTINCT a.user_id) FROM pg_temp.m_act a JOIN pg_temp.m_students x ON x.id = a.user_id
               WHERE x.department_id IS NOT DISTINCT FROM s.department_id AND a.at > now() - interval '7 days')::int AS active_7d,
             (SELECT count(DISTINCT a.user_id) FROM pg_temp.m_act a JOIN pg_temp.m_students x ON x.id = a.user_id
               WHERE x.department_id IS NOT DISTINCT FROM s.department_id AND a.kind IN ('post', 'reply', 'file')
                 AND a.at > now() - interval '30 days')::int AS contributors_30d,
             ((SELECT count(*) FROM public.course_files f JOIN public.courses c ON c.id = f.course_id
                WHERE c.department_id = s.department_id AND NOT f.hidden AND f.created_at > now() - interval '30 days')
              + (SELECT count(*) FROM public.posts p JOIN public.courses c ON c.id = p.course_id
                WHERE c.department_id = s.department_id AND p.deleted_at IS NULL AND p.created_at > now() - interval '30 days'))::int AS resources_30d
      FROM pg_temp.m_students s GROUP BY s.department_id) d)
  ) INTO result;
  -- O4 proposal, read-only
  result := jsonb_set(result, '{departments}', coalesce((
    SELECT jsonb_agg(d || jsonb_build_object('ready', (d->>'department_id') IS NOT NULL AND (d->>'students')::int >= 8
                                             AND (d->>'active_7d')::int >= 3 AND (d->>'resources_30d')::int >= 3))
    FROM jsonb_array_elements(result->'departments') d), '[]'));
  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_metrics(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics(text) TO authenticated;
