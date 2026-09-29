-- An admin who reports something kept losing their own "reports to review" notification (it was deleted for
-- every admin, then re-created for everyone except the reporter). Refresh it only for the admins who get a new one.
CREATE OR REPLACE FUNCTION private.on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.reporter_id IS NOT NULL THEN
    DELETE FROM public.notifications n USING private.admins a
    WHERE n.user_id = a.user_id AND n.kind = 'report' AND a.user_id <> NEW.reporter_id;
    INSERT INTO public.notifications (user_id, actor_id, kind)
    SELECT a.user_id, NEW.reporter_id, 'report' FROM private.admins a WHERE a.user_id <> NEW.reporter_id;
  END IF;

  IF NEW.kind = 'post' AND (SELECT count(DISTINCT r.reporter_id) FROM public.reports r
                            WHERE r.kind = 'post' AND r.target_id = NEW.target_id AND r.resolved_at IS NULL) >= 3 THEN
    UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END $$;
