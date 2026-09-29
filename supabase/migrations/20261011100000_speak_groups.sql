-- Speak G1: groups (like Facebook groups). Public groups: anyone reads, anyone joins at once. Private groups:
-- name/description are discoverable, but voices and members are for members only; people join by request
-- (approved by the group's admins) or by an invite from a member who is their friend (mutual follow).
-- Group voices live only inside the group (never in For you / sections / profiles) and can't be reposted.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  section_id text NOT NULL REFERENCES public.sections (id),
  privacy text NOT NULL CHECK (privacy IN ('public', 'private')),
  members_count int NOT NULL DEFAULT 0,
  posts_count int NOT NULL DEFAULT 0,
  last_post_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX groups_popular ON public.groups (members_count DESC, created_at DESC);

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE UNIQUE INDEX group_members_one_owner ON public.group_members (group_id) WHERE role = 'owner';
CREATE INDEX group_members_user ON public.group_members (user_id);

-- A pending join: 'request' (the user asked, admins decide) or 'invite' (a member invited them, they decide).
CREATE TABLE public.group_requests (
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('request', 'invite')),
  invited_by uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id),
  CHECK ((kind = 'invite') = (invited_by IS NOT NULL))
);
CREATE INDEX group_requests_user ON public.group_requests (user_id);

ALTER TABLE public.posts ADD COLUMN group_id uuid REFERENCES public.groups (id) ON DELETE CASCADE;
CREATE INDEX posts_group ON public.posts (group_id, created_at DESC) WHERE group_id IS NOT NULL AND reply_to IS NULL AND NOT hidden;

ALTER TABLE public.notifications ADD COLUMN group_id uuid REFERENCES public.groups (id) ON DELETE CASCADE;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('follow', 'like', 'reply', 'repost', 'report', 'group_invite', 'group_request', 'group_accepted'));

ALTER TABLE public.reports DROP CONSTRAINT reports_kind_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_kind_check CHECK (kind IN ('user', 'voice_message', 'post', 'group'));
ALTER TABLE public.reports DROP CONSTRAINT reports_action_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_action_check
  CHECK (action IN ('dismiss', 'hide_post', 'disable_user', 'delete_group'));

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE FUNCTION private.group_role(p_user uuid, p_group uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.group_members WHERE group_id = p_group AND user_id = p_user
$$;

CREATE FUNCTION private.is_group_admin(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.group_role(p_user, p_group) IN ('owner', 'admin'), false)
$$;

-- Public group, or a member of a private one.
CREATE FUNCTION private.can_see_group(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_group AND g.privacy = 'public')
      OR EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = p_group AND m.user_id = p_user)
$$;

CREATE OR REPLACE FUNCTION private.can_see_post(p_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
    WHERE p.id = p_post AND NOT p.hidden AND NOT a.disabled
      AND NOT private.is_blocked(auth.uid(), p.author_id)
      AND (p.group_id IS NULL OR private.can_see_group(auth.uid(), p.group_id)))
$$;

-- One row per (recipient, actor, kind, group); not to yourself or across a block.
CREATE FUNCTION private.notify_group(p_user uuid, p_actor uuid, p_kind text, p_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user IS NULL OR p_user = p_actor OR private.is_blocked(p_user, p_actor) THEN RETURN; END IF;
  DELETE FROM public.notifications WHERE user_id = p_user AND actor_id = p_actor AND kind = p_kind AND group_id = p_group;
  INSERT INTO public.notifications (user_id, actor_id, kind, group_id) VALUES (p_user, p_actor, p_kind, p_group);
END $$;

-- Member counter; when the owner goes (left or account deleted) the oldest admin, else the oldest member,
-- becomes the owner; a group with nobody left is deleted.
CREATE FUNCTION private.group_members_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE heir uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET members_count = members_count + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  END IF;
  UPDATE public.groups SET members_count = greatest(members_count - 1, 0) WHERE id = OLD.group_id;
  IF OLD.role = 'owner' AND EXISTS (SELECT 1 FROM public.groups WHERE id = OLD.group_id) THEN
    SELECT user_id INTO heir FROM public.group_members WHERE group_id = OLD.group_id
    ORDER BY (role = 'admin') DESC, created_at LIMIT 1;
    IF heir IS NULL THEN
      DELETE FROM public.groups WHERE id = OLD.group_id;
    ELSE
      UPDATE public.group_members SET role = 'owner' WHERE group_id = OLD.group_id AND user_id = heir;
    END IF;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER group_members_changed AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION private.group_members_changed();

-- Group voice counter (top-level voices only).
CREATE FUNCTION private.group_posts_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.group_id IS NOT NULL AND NEW.reply_to IS NULL THEN
      UPDATE public.groups SET posts_count = posts_count + 1, last_post_at = NEW.created_at WHERE id = NEW.group_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.group_id IS NOT NULL AND OLD.reply_to IS NULL THEN
    UPDATE public.groups SET posts_count = greatest(posts_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER posts_group_counter AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.group_posts_changed();

-- ---------------------------------------------------------------------------
-- 3. Row level security (reads only; every write goes through the RPCs below)
-- ---------------------------------------------------------------------------
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY group_members_select ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.can_see_group(auth.uid(), group_id));
CREATE POLICY group_requests_select ON public.group_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_group_admin(auth.uid(), group_id));

-- ---------------------------------------------------------------------------
-- 4. Create / edit / delete
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.create_group(p_name text, p_section text, p_privacy text, p_description text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  gid uuid;
BEGIN
  IF p_privacy NOT IN ('public', 'private') THEN RAISE EXCEPTION 'bad_privacy' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = p_section) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;
  PERFORM private.rate_limit('create_group', 5, interval '1 day');
  INSERT INTO public.groups (name, description, section_id, privacy)
  VALUES (btrim(p_name), left(btrim(coalesce(p_description, '')), 300), p_section, p_privacy)
  RETURNING id INTO gid;
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (gid, uid, 'owner');
  RETURN gid;
END $$;

-- Owner and admins. Making a group public lets everyone waiting for approval in.
CREATE FUNCTION public.update_group(p_group uuid, p_name text, p_section text, p_privacy text, p_description text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_group_admin(uid, p_group) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_privacy NOT IN ('public', 'private') THEN RAISE EXCEPTION 'bad_privacy' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = p_section) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;
  UPDATE public.groups
  SET name = btrim(p_name), description = left(btrim(coalesce(p_description, '')), 300), section_id = p_section,
      privacy = p_privacy
  WHERE id = p_group;
  IF p_privacy = 'public' THEN
    INSERT INTO public.group_members (group_id, user_id)
    SELECT group_id, user_id FROM public.group_requests WHERE group_id = p_group AND kind = 'request'
    ON CONFLICT DO NOTHING;
    DELETE FROM public.group_requests WHERE group_id = p_group AND kind = 'request';
  END IF;
END $$;

CREATE FUNCTION public.delete_group(p_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF coalesce(private.group_role(uid, p_group), '') <> 'owner' THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.groups WHERE id = p_group;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Joining: join / request, invites, approvals, leaving, roles
-- ---------------------------------------------------------------------------
-- Public group or a pending invite → member at once ('joined'); private group → a request ('requested').
CREATE FUNCTION public.join_group(p_group uuid)
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
    IF inv.kind = 'invite' THEN PERFORM private.notify_group(inv.invited_by, uid, 'group_accepted', p_group); END IF;
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

-- Leave the group, cancel your request or decline an invite.
CREATE FUNCTION public.leave_group(p_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  DELETE FROM public.group_requests WHERE group_id = p_group AND user_id = uid;
  DELETE FROM public.group_members WHERE group_id = p_group AND user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid AND group_id = p_group AND kind = 'group_invite';
END $$;

-- Any member may invite a friend (mutual follow). An invite is pre-approved: accepting it joins the group.
CREATE FUNCTION public.invite_to_group(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF private.group_role(uid, p_group) IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
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

-- Admins approve or decline a join request.
CREATE FUNCTION public.respond_group_request(p_group uuid, p_user uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_group_admin(uid, p_group) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.group_requests WHERE group_id = p_group AND user_id = p_user AND kind = 'request';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.notifications WHERE group_id = p_group AND actor_id = p_user AND kind = 'group_request';
  IF p_accept THEN
    INSERT INTO public.group_members (group_id, user_id) VALUES (p_group, p_user) ON CONFLICT DO NOTHING;
    PERFORM private.notify_group(p_user, uid, 'group_accepted', p_group);
  END IF;
END $$;

-- Owner: make someone an admin / back to member, or hand the group over ('owner' → you become an admin).
CREATE FUNCTION public.set_group_role(p_group uuid, p_user uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF coalesce(private.group_role(uid, p_group), '') <> 'owner' OR p_user = uid THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('owner', 'admin', 'member') THEN RAISE EXCEPTION 'bad_role' USING ERRCODE = '22023'; END IF;
  IF private.group_role(p_user, p_group) IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_role = 'owner' THEN
    UPDATE public.group_members SET role = 'admin' WHERE group_id = p_group AND user_id = uid;
  END IF;
  UPDATE public.group_members SET role = p_role WHERE group_id = p_group AND user_id = p_user;
END $$;

-- Admins remove members (the owner removes admins too; nobody removes the owner).
CREATE FUNCTION public.remove_group_member(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  mine text := private.group_role(uid, p_group);
  theirs text := private.group_role(p_user, p_group);
BEGIN
  IF theirs IS NULL THEN RETURN; END IF;
  IF p_user = uid OR mine IS NULL OR mine = 'member' OR theirs = 'owner' OR (theirs = 'admin' AND mine <> 'owner') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.group_members WHERE group_id = p_group AND user_id = p_user;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reading
-- ---------------------------------------------------------------------------
-- One group with your relation to it. Private groups show their name, description and counts to everyone.
CREATE FUNCTION public.group_detail(p_group uuid)
RETURNS TABLE (id uuid, name text, description text, section_id text, privacy text, members_count int,
               posts_count int, created_at timestamptz, my_role text, my_pending text, invited_by_name text,
               pending_requests int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.description, g.section_id, g.privacy, g.members_count, g.posts_count, g.created_at,
         private.group_role(uid, g.id), r.kind, ip.full_name,
         CASE WHEN private.is_group_admin(uid, g.id)
              THEN (SELECT count(*)::int FROM public.group_requests q WHERE q.group_id = g.id AND q.kind = 'request')
              ELSE 0 END
  FROM public.groups g
  LEFT JOIN public.group_requests r ON r.group_id = g.id AND r.user_id = uid
  LEFT JOIN public.profiles ip ON ip.id = r.invited_by
  WHERE g.id = p_group;
END $$;

-- Your groups (most recently active first), with pending join requests for the ones you run.
CREATE FUNCTION public.my_groups()
RETURNS TABLE (id uuid, name text, section_id text, privacy text, members_count int, posts_count int,
               last_post_at timestamptz, my_role text, pending_requests int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.section_id, g.privacy, g.members_count, g.posts_count, g.last_post_at, m.role,
         CASE WHEN m.role IN ('owner', 'admin')
              THEN (SELECT count(*)::int FROM public.group_requests q WHERE q.group_id = g.id AND q.kind = 'request')
              ELSE 0 END
  FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id = uid
  ORDER BY coalesce(g.last_post_at, g.created_at) DESC;
END $$;

-- Invites waiting for you.
CREATE FUNCTION public.my_group_invites()
RETURNS TABLE (id uuid, name text, section_id text, privacy text, members_count int, invited_by_name text,
               invited_by_username text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.section_id, g.privacy, g.members_count, p.full_name, p.username, r.created_at
  FROM public.group_requests r
  JOIN public.groups g ON g.id = r.group_id
  JOIN public.profiles p ON p.id = r.invited_by
  WHERE r.user_id = uid AND r.kind = 'invite' AND NOT private.is_blocked(uid, r.invited_by)
  ORDER BY r.created_at DESC;
END $$;

-- Find groups by name (Greek or Latin, accents ignored) and/or category; without a query: the biggest ones.
CREATE FUNCTION public.discover_groups(p_query text DEFAULT NULL, p_section text DEFAULT NULL, p_limit int DEFAULT 30)
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
  WHERE (p_section IS NULL OR g.section_id = p_section)
    AND (char_length(q) < 2 OR position(q IN translate(private.slugify(g.name), '._', '')) > 0)
  ORDER BY (char_length(q) >= 2 AND starts_with(translate(private.slugify(g.name), '._', ''), q)) DESC,
           g.members_count DESC, g.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
END $$;

-- Members (public group: anyone; private: members). Owner, admins, then everyone else.
CREATE FUNCTION public.group_members_list(p_group uuid, p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_path text, role text, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.can_see_group(uid, p_group) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_path, m.role, m.created_at
  FROM public.group_members m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.group_id = p_group AND NOT p.disabled AND NOT private.is_blocked(uid, p.id)
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;

-- Join requests (admins only).
CREATE FUNCTION public.group_requests_list(p_group uuid)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_path text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT private.is_group_admin(uid, p_group) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_path, r.created_at
  FROM public.group_requests r JOIN public.profiles p ON p.id = r.user_id
  WHERE r.group_id = p_group AND r.kind = 'request' AND NOT p.disabled
  ORDER BY r.created_at;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Posting into a group
-- ---------------------------------------------------------------------------
DROP FUNCTION public.create_post(text, uuid, uuid, uuid, text, text, text, int);
CREATE FUNCTION public.create_post(
  p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_reply_to uuid DEFAULT NULL,
  p_repost_of uuid DEFAULT NULL, p_title text DEFAULT NULL, p_path text DEFAULT NULL,
  p_mime text DEFAULT NULL, p_duration_ms int DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_section text := p_section;
  v_topic uuid := p_topic;
  v_group uuid := p_group;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  parent public.posts;
  pid uuid;
BEGIN
  IF p_reply_to IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_reply_to;
    IF NOT FOUND OR NOT private.can_see_post(p_reply_to) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_section := parent.section_id;
    v_topic := parent.topic_id;
    v_group := parent.group_id;
  ELSIF p_repost_of IS NOT NULL THEN
    SELECT * INTO parent FROM public.posts WHERE id = p_repost_of;
    -- group voices stay in their group
    IF NOT FOUND OR NOT private.can_see_post(p_repost_of) OR parent.audio_path IS NULL OR parent.group_id IS NOT NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_section := parent.section_id;
    v_topic := NULL;
    v_group := NULL;
  ELSIF v_group IS NOT NULL THEN
    SELECT section_id INTO v_section FROM public.groups WHERE id = v_group;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
    v_topic := NULL;
  ELSIF v_topic IS NOT NULL THEN
    SELECT section_id INTO v_section FROM public.topics WHERE id = v_topic AND NOT hidden;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  -- only members speak in a group (replies included)
  IF v_group IS NOT NULL AND private.group_role(uid, v_group) IS NULL THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  IF v_section IS NULL OR NOT EXISTS (SELECT 1 FROM public.sections WHERE id = v_section) THEN
    RAISE EXCEPTION 'bad_section' USING ERRCODE = '22023';
  END IF;

  IF p_path IS NULL THEN
    IF p_repost_of IS NULL OR v_title IS NOT NULL THEN
      RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
    END IF;
  ELSIF NOT starts_with(p_path, uid::text || '/') OR char_length(p_path) > 200
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voices' AND name = p_path) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM private.rate_limit('post', 30, interval '1 hour');
  INSERT INTO public.posts (author_id, section_id, topic_id, reply_to, repost_of, title, audio_path, mime, duration_ms, group_id)
  VALUES (uid, v_section, v_topic, p_reply_to, p_repost_of, left(v_title, 100), p_path,
          CASE WHEN p_path IS NULL THEN NULL ELSE private.normalize_audio_mime(p_mime) END,
          CASE WHEN p_path IS NULL THEN NULL ELSE p_duration_ms END, v_group)
  RETURNING id INTO pid;
  RETURN pid;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Feeds: group voices only in 'group' (one group) and 'groups' (all yours); + group columns
-- ---------------------------------------------------------------------------
DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[]);
CREATE FUNCTION public.feed_posts(
  p_scope text, p_section text DEFAULT NULL, p_topic uuid DEFAULT NULL, p_author uuid DEFAULT NULL,
  p_parent uuid DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 20,
  p_offset int DEFAULT 0, p_ids uuid[] DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS TABLE (
  post_id uuid, created_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  section_id text, topic_id uuid, topic_title text, reply_to uuid, repost_of uuid, title text, audio_path text,
  duration_ms int, likes_count int, replies_count int, reposts_count int, listens_count int,
  liked boolean, reposted boolean, is_mine boolean,
  orig_author_username text, orig_author_name text, orig_author_avatar text, orig_title text,
  orig_audio_path text, orig_duration_ms int, orig_created_at timestamptz, orig_author_id uuid,
  orig_likes_count int, orig_replies_count int, orig_reposts_count int, orig_listens_count int,
  reply_to_username text, group_id uuid, group_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('foryou', 'all', 'following', 'section', 'topic', 'author', 'author_replies', 'replies', 'one', 'ids',
                     'group', 'groups') THEN
    RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id, p.created_at, a.id, a.username, a.full_name, a.avatar_path,
         p.section_id, p.topic_id, t.title, p.reply_to, p.repost_of, p.title, p.audio_path,
         p.duration_ms, p.likes_count, p.replies_count, p.reposts_count, p.listens_count,
         EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND l.user_id = uid),
         EXISTS (SELECT 1 FROM public.posts r WHERE r.repost_of = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND r.author_id = uid AND r.audio_path IS NULL),
         p.author_id = uid,
         oa.username, oa.full_name, oa.avatar_path, o.title, o.audio_path, o.duration_ms, o.created_at, o.author_id,
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count,
         ra.username, p.group_id, g.name
  FROM public.posts p
  JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  LEFT JOIN public.groups g ON g.id = p.group_id
  WHERE NOT p.hidden AND NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
    AND (o.id IS NULL OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p.group_id IS NULL OR private.can_see_group(uid, p.group_id))
    AND (p_before IS NULL OR p_scope IN ('foryou', 'one', 'ids')
         OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'foryou' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.audio_path IS NOT NULL AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.group_id IS NULL AND p.reply_to IS NULL
      WHEN 'following' THEN p.group_id IS NULL AND p.reply_to IS NULL AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'group' THEN p.group_id = p_group AND p.reply_to IS NULL
      WHEN 'groups' THEN p.reply_to IS NULL
                         AND p.group_id IN (SELECT m.group_id FROM public.group_members m WHERE m.user_id = uid)
      WHEN 'one' THEN p.id = p_parent
      WHEN 'ids' THEN p.id = ANY (p_ids)
      ELSE p.reply_to = p_parent
    END
  ORDER BY
    CASE WHEN p_scope = 'foryou' THEN
      (1 + p.likes_count * 3 + p.replies_count * 4 + p.reposts_count * 5 + p.listens_count)::float8
      * CASE WHEN private.follows(uid, p.author_id) THEN 1.5 ELSE 1 END
      * CASE WHEN p.author_id = uid THEN 0.5 ELSE 1 END
      / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.5)
    END DESC NULLS LAST,
    CASE WHEN p_scope = 'ids' THEN array_position(p_ids, p.id) END ASC NULLS LAST,
    CASE WHEN p_scope = 'replies' THEN p.created_at END ASC NULLS LAST,
    p.created_at DESC
  OFFSET CASE WHEN p_scope = 'foryou' THEN least(greatest(coalesce(p_offset, 0), 0), 1000) ELSE 0 END
  LIMIT lim;
END $$;

-- Topics and profile counts only count voices outside groups.
CREATE OR REPLACE FUNCTION public.trending_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text,
               created_at timestamptz, posts_count int, recent_posts int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT p.topic_id, count(*)::int AS n,
           sum(p.likes_count * 2 + p.replies_count * 3 + p.listens_count)::float8 AS engagement
    FROM public.posts p
    WHERE p.topic_id IS NOT NULL AND p.group_id IS NULL AND p.reply_to IS NULL AND NOT p.hidden
      AND p.created_at > now() - interval '24 hours'
    GROUP BY p.topic_id
  )
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.created_at, t.posts_count,
         coalesce(r.n, 0)
  FROM public.topics t
  LEFT JOIN recent r ON r.topic_id = t.id
  WHERE NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND t.created_at > now() - interval '14 days'
  ORDER BY t.pinned DESC, coalesce(r.n, 0) * 10 + coalesce(r.engagement, 0) DESC, t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
END $$;

CREATE OR REPLACE FUNCTION public.profile_stats(p_user uuid)
RETURNS TABLE (followers int, following int, posts int, i_follow boolean, follows_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF private.is_blocked(uid, p_user) THEN RETURN; END IF;
  RETURN QUERY SELECT
    (SELECT count(*)::int FROM public.follows WHERE followee_id = p_user),
    (SELECT count(*)::int FROM public.follows WHERE follower_id = p_user),
    (SELECT count(*)::int FROM public.posts WHERE author_id = p_user AND reply_to IS NULL AND group_id IS NULL AND NOT hidden),
    private.follows(uid, p_user),
    private.follows(p_user, uid);
END $$;

-- ---------------------------------------------------------------------------
-- 9. Moderation: groups can be reported; admins can delete a reported group
-- ---------------------------------------------------------------------------
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
  END IF;
  IF target_user IS NULL OR target_user = uid THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.rate_limit('report', 20, interval '1 hour');
  INSERT INTO public.reports (reporter_id, target_user_id, kind, target_id, reason)
  VALUES (uid, target_user, p_kind, CASE WHEN p_kind = 'user' THEN NULL ELSE p_target END, left(coalesce(p_reason, ''), 500));
END $$;

DROP FUNCTION public.admin_reports(boolean, int);
CREATE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, kind text, reason text, created_at timestamptz, resolved_at timestamptz, action text,
               reporter_username text, target_user_id uuid, target_username text, target_name text,
               target_avatar text, target_disabled boolean, target_is_admin boolean, target_id uuid,
               post_title text, post_audio_path text, post_duration_ms int, post_hidden boolean,
               post_exists boolean, reports_on_target int, group_name text, group_exists boolean)
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
            AND CASE WHEN r.kind IN ('post', 'group') THEN o.target_id = r.target_id ELSE o.target_user_id = r.target_user_id END),
         g.name, g.id IS NOT NULL
  FROM public.reports r
  JOIN public.profiles u ON u.id = r.target_user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.posts p ON r.kind = 'post' AND p.id = r.target_id
  LEFT JOIN public.groups g ON r.kind = 'group' AND g.id = r.target_id
  WHERE (r.resolved_at IS NULL) = coalesce(p_open, true)
  ORDER BY CASE WHEN coalesce(p_open, true) THEN r.created_at END ASC,
           r.resolved_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report uuid, p_action text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  r public.reports;
  n int;
BEGIN
  IF NOT private.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_action NOT IN ('dismiss', 'hide_post', 'disable_user', 'delete_group')
     OR (p_action = 'hide_post' AND r.kind <> 'post') OR (p_action = 'delete_group' AND r.kind <> 'group') THEN
    RAISE EXCEPTION 'bad_action' USING ERRCODE = '22023';
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

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
