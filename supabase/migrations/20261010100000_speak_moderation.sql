-- Speak S6: moderation inside the app (App Store 1.2: act on reports within 24 h).
-- Admins get a notification for new reports, review them in the app and hide the post, disable the account or
-- dismiss the report; a post reported by 3 different people is hidden until an admin looks at it.

ALTER TABLE public.reports
  ADD COLUMN action text CHECK (action IN ('dismiss', 'hide_post', 'disable_user')),
  ADD COLUMN resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;
CREATE INDEX reports_target ON public.reports (target_id) WHERE resolved_at IS NULL;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('follow', 'like', 'reply', 'repost', 'report'));

-- New report → every admin gets one "reports to review" row (kept at the top, not one per report),
-- and a post with 3 distinct open reporters is hidden until reviewed.
CREATE FUNCTION private.on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.notifications n USING private.admins a WHERE n.user_id = a.user_id AND n.kind = 'report';
  INSERT INTO public.notifications (user_id, actor_id, kind)
  SELECT a.user_id, NEW.reporter_id, 'report' FROM private.admins a
  WHERE NEW.reporter_id IS NOT NULL AND a.user_id <> NEW.reporter_id;

  IF NEW.kind = 'post' AND (SELECT count(DISTINCT r.reporter_id) FROM public.reports r
                            WHERE r.kind = 'post' AND r.target_id = NEW.target_id AND r.resolved_at IS NULL) >= 3 THEN
    UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reports_after_insert AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.on_report();

-- The review queue (p_open) or the history. One row per report; reports_on_target counts the open reports
-- about the same post (or the same person for user / voice-message reports).
CREATE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, kind text, reason text, created_at timestamptz, resolved_at timestamptz, action text,
               reporter_username text, target_user_id uuid, target_username text, target_name text,
               target_avatar text, target_disabled boolean, target_is_admin boolean, target_id uuid,
               post_title text, post_audio_path text, post_duration_ms int, post_hidden boolean,
               post_exists boolean, reports_on_target int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT r.id, r.kind, r.reason, r.created_at, r.resolved_at, r.action,
         rp.username, u.id, u.username, u.full_name, u.avatar_path, u.disabled, private.is_admin(u.id), r.target_id,
         p.title, p.audio_path, p.duration_ms, p.hidden, p.id IS NOT NULL,
         (SELECT count(*)::int FROM public.reports o
          WHERE o.resolved_at IS NULL AND o.kind = r.kind
            AND CASE WHEN r.kind = 'post' THEN o.target_id = r.target_id ELSE o.target_user_id = r.target_user_id END)
  FROM public.reports r
  JOIN public.profiles u ON u.id = r.target_user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
  WHERE (r.resolved_at IS NULL) = coalesce(p_open, true)
  ORDER BY CASE WHEN coalesce(p_open, true) THEN r.created_at END ASC,
           r.resolved_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

-- Close a report with an action. hide_post / disable_user also close every open report about the same
-- post / person; dismiss closes the open reports about the same target.
CREATE FUNCTION public.admin_resolve_report(p_report uuid, p_action text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  r public.reports;
  n int;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_action NOT IN ('dismiss', 'hide_post', 'disable_user') OR (p_action = 'hide_post' AND r.kind <> 'post') THEN
    RAISE EXCEPTION 'bad_action' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'hide_post' THEN
    UPDATE public.posts SET hidden = true WHERE id = r.target_id;
  ELSIF p_action = 'disable_user' THEN
    IF private.is_admin(r.target_user_id) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    UPDATE public.profiles SET disabled = true WHERE id = r.target_user_id;
  END IF;

  UPDATE public.reports o SET resolved_at = now(), action = p_action, resolved_by = uid
  WHERE o.resolved_at IS NULL AND (o.id = r.id OR CASE
      WHEN p_action = 'disable_user' THEN o.target_user_id = r.target_user_id
      WHEN r.kind = 'post' THEN o.kind = 'post' AND o.target_id = r.target_id
      ELSE o.kind = r.kind AND o.target_user_id = r.target_user_id END);
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Queue empty → the admins' "reports to review" notification goes away.
  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE resolved_at IS NULL) THEN
    DELETE FROM public.notifications WHERE kind = 'report';
  END IF;
  RETURN n;
END $$;

-- Undo: show a hidden post again / re-enable an account.
CREATE FUNCTION public.admin_set_post_hidden(p_post uuid, p_hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.posts SET hidden = coalesce(p_hidden, true) WHERE id = p_post;
END $$;

CREATE FUNCTION public.admin_set_user_disabled(p_user uuid, p_disabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) OR private.is_admin(p_user) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET disabled = coalesce(p_disabled, true) WHERE id = p_user;
END $$;

-- Open reports count (badge on the admin row in Settings).
CREATE FUNCTION public.admin_open_reports()
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT count(*)::int FROM public.reports WHERE resolved_at IS NULL);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
