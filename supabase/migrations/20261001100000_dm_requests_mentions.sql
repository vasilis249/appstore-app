-- Instagram-style DMs and @mention notifications.
-- * Anyone can message anyone (unless blocked); conversations started by people
--   you don't follow land in "Requests" (conversation_members.accepted = false).
-- * Replying accepts the request.
-- * Message writes are validated in the database too (clients can insert
--   through PostgREST), not only in the web server.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Membership is managed only by the web server (service_role).
--    Before this, a member could UPDATE their own row (e.g. role = 'admin') and a
--    creator could INSERT any user as a member, bypassing blocks and requests.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Creator can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members update own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can leave" ON public.conversation_members;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.conversation_members FROM anon, authenticated;
DROP POLICY IF EXISTS "Authenticated can create conversations" ON public.conversations;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.conversations FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.messages FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Message guard (client inserts only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _type text;
  _peer uuid;
BEGIN
  -- Server-side writers (service_role, triggers) are trusted.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  NEW.deleted_at := NULL;
  NEW.deleted_by := NULL;
  NEW.created_at := now();

  IF char_length(NEW.body) > 2000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(btrim(NEW.body)) = 0 AND NEW.post_id IS NULL AND NEW.story_id IS NULL THEN
    RAISE EXCEPTION 'empty_message' USING ERRCODE = 'check_violation';
  END IF;

  IF (SELECT count(*) FROM public.messages
      WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT type INTO _type FROM public.conversations WHERE id = NEW.conversation_id;
  IF _type = 'direct' THEN
    SELECT user_id INTO _peer FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id AND user_id <> auth.uid()
    LIMIT 1;
    IF _peer IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
    END IF;
    IF public.is_blocked_between(auth.uid(), _peer) THEN
      RAISE EXCEPTION 'blocked' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Shared posts / replied stories must be visible to the sender.
  IF NEW.post_id IS NOT NULL AND NOT public.can_view_post(auth.uid(), NEW.post_id) THEN
    RAISE EXCEPTION 'post_not_visible' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.story_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = NEW.story_id AND s.expires_at > now()
      AND public.can_view_profile(auth.uid(), s.author_id)
  ) THEN
    RAISE EXCEPTION 'story_not_visible' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard ON public.messages;
CREATE TRIGGER messages_guard BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard();

-- Replying to a request accepts it; sending also marks the thread as read.
CREATE OR REPLACE FUNCTION public.messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id IS NOT NULL THEN
    UPDATE public.conversation_members
    SET accepted = true, last_read_at = NEW.created_at
    WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_after_insert ON public.messages;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_after_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Inbox in one query (RLS applies: members only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_inbox()
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  accepted boolean,
  last_read_at timestamptz,
  last_body text,
  last_sender_id uuid,
  last_at timestamptz,
  last_kind text,
  unread bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id, c.type, c.title, m.accepted, m.last_read_at,
    lm.body, lm.sender_id, COALESCE(lm.created_at, c.created_at),
    CASE WHEN lm.post_id IS NOT NULL THEN 'post' WHEN lm.story_id IS NOT NULL THEN 'story' ELSE 'text' END,
    (SELECT count(*) FROM public.messages x
     WHERE x.conversation_id = c.id AND x.deleted_at IS NULL
       AND x.sender_id IS DISTINCT FROM auth.uid()
       AND (m.last_read_at IS NULL OR x.created_at > m.last_read_at))
  FROM public.conversation_members m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN LATERAL (
    SELECT body, sender_id, created_at, post_id, story_id
    FROM public.messages
    WHERE conversation_id = c.id AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE m.user_id = auth.uid()
    -- An empty request (no messages yet) isn't shown to the recipient.
    AND (m.accepted OR lm.created_at IS NOT NULL)
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.my_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_inbox() TO authenticated;

CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON public.messages (sender_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. @mention notifications (captions and comments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid;
  _post uuid;
  _text text;
  _skip uuid;
  _name text;
  _target uuid;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    _actor := NEW.author_id;
    _post := NEW.id;
    _text := NEW.caption;
    _skip := NULL;
  ELSE
    _actor := NEW.author_id;
    _post := NEW.post_id;
    _text := NEW.body;
    -- The post author already gets a comment notification.
    SELECT author_id INTO _skip FROM public.posts WHERE id = NEW.post_id;
  END IF;
  IF _text IS NULL OR position('@' IN _text) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username) INTO _name FROM public.profiles WHERE user_id = _actor;

  FOR _target IN
    SELECT DISTINCT p.user_id
    FROM (SELECT (regexp_matches(_text, '@([a-z0-9._]{3,30})', 'g'))[1] AS u LIMIT 20) m
    JOIN public.profiles p ON p.username = m.u
    WHERE p.user_id <> _actor
      AND p.user_id IS DISTINCT FROM _skip
      AND NOT public.is_blocked_between(_actor, p.user_id)
      AND public.can_view_post(p.user_id, _post)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      _target, 'mention', 'Σε ανέφεραν',
      COALESCE(_name, 'Ένας παίκτης') || ' σε ανέφερε: ' || left(_text, 80),
      jsonb_build_object('post_id', _post, 'user_id', _actor)
        || CASE WHEN TG_TABLE_NAME = 'post_comments' THEN jsonb_build_object('comment_id', NEW.id) ELSE '{}'::jsonb END
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_notify_mentions ON public.posts;
CREATE TRIGGER posts_notify_mentions AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();
DROP TRIGGER IF EXISTS post_comments_notify_mentions ON public.post_comments;
CREATE TRIGGER post_comments_notify_mentions AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();

REVOKE EXECUTE ON FUNCTION public.messages_after_insert(), public.notify_mentions()
  FROM PUBLIC, anon, authenticated;

-- Live "Seen" receipts: members' last_read_at changes are streamed (RLS applies).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_members'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;
END $$;
