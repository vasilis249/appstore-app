-- The inviter is told "X joined the group" (group_joined), not "you were accepted" (group_accepted).
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('follow', 'like', 'reply', 'repost', 'report', 'group_invite', 'group_request', 'group_accepted', 'group_joined'));

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
