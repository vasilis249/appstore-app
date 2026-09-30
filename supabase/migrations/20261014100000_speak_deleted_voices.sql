-- Deleting a voice no longer takes other people's voices with it (like X).
--   Before: posts.reply_to / repost_of are ON DELETE CASCADE, so deleting a voice (or an account) also deleted
--   every reply and quote under it — other people's voices — and left their audio files in `voices`.
--   Now a voice that has replies or quotes becomes a tombstone ("Αυτή η φωνή διαγράφηκε"): no author, no audio,
--   no title, likes/listens/plain reposts/notifications gone; the conversation under it stays. A voice without
--   replies or quotes is deleted as before. A tombstone disappears by itself once its last reply / quote goes.
--   Account deletion does the same for the account's voices that others answered.
-- Also: public.orphan_voice_files() lists audio in `voices` that no post points at any more (deleted groups,
-- deleted accounts, failed uploads); the Worker (service role) removes them through the Storage API, since SQL
-- can't delete storage objects.

ALTER TABLE public.posts ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.posts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.posts DROP CONSTRAINT posts_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_kind_check CHECK (
  (audio_path IS NOT NULL AND mime IS NOT NULL AND duration_ms IS NOT NULL AND deleted_at IS NULL)
  OR (audio_path IS NULL AND mime IS NULL AND duration_ms IS NULL AND title IS NULL
      AND (repost_of IS NOT NULL OR deleted_at IS NOT NULL)));
ALTER TABLE public.posts ADD CONSTRAINT posts_tombstone_check CHECK ((author_id IS NULL) = (deleted_at IS NOT NULL));

-- Counters: a tombstone already gave its topic / group count back when it was made (see remove_post), so its
-- final delete must not take it again.
CREATE OR REPLACE FUNCTION private.posts_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to IS NOT NULL THEN
      UPDATE public.posts SET replies_count = replies_count + 1 WHERE id = NEW.reply_to;
    END IF;
    IF NEW.repost_of IS NOT NULL THEN
      UPDATE public.posts SET reposts_count = reposts_count + 1 WHERE id = NEW.repost_of;
    END IF;
    IF NEW.topic_id IS NOT NULL AND NEW.reply_to IS NULL THEN
      UPDATE public.topics SET posts_count = posts_count + 1, last_post_at = NEW.created_at WHERE id = NEW.topic_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.reply_to IS NOT NULL THEN
    UPDATE public.posts SET replies_count = greatest(replies_count - 1, 0) WHERE id = OLD.reply_to;
  END IF;
  IF OLD.repost_of IS NOT NULL THEN
    UPDATE public.posts SET reposts_count = greatest(reposts_count - 1, 0) WHERE id = OLD.repost_of;
  END IF;
  IF OLD.topic_id IS NOT NULL AND OLD.reply_to IS NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.topics SET posts_count = greatest(posts_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION private.group_posts_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.group_id IS NOT NULL AND NEW.reply_to IS NULL THEN
      UPDATE public.groups SET posts_count = posts_count + 1, last_post_at = NEW.created_at WHERE id = NEW.group_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.group_id IS NOT NULL AND OLD.reply_to IS NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.groups SET posts_count = greatest(posts_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN OLD;
END $$;

-- Delete a voice, or turn it into a tombstone when others answered or quoted it.
CREATE FUNCTION private.remove_post(p_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = p_post FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posts c
                 WHERE c.reply_to = p_post OR (c.repost_of = p_post AND c.audio_path IS NOT NULL)) THEN
    DELETE FROM public.posts WHERE id = p_post;
    RETURN;
  END IF;
  DELETE FROM public.posts WHERE repost_of = p_post AND audio_path IS NULL AND deleted_at IS NULL;  -- plain reposts
  DELETE FROM public.post_likes WHERE post_id = p_post;
  DELETE FROM public.post_listens WHERE post_id = p_post;
  DELETE FROM public.notifications WHERE post_id = p_post;
  IF p.reply_to IS NULL AND p.topic_id IS NOT NULL THEN
    UPDATE public.topics SET posts_count = greatest(posts_count - 1, 0) WHERE id = p.topic_id;
  END IF;
  IF p.reply_to IS NULL AND p.group_id IS NOT NULL THEN
    UPDATE public.groups SET posts_count = greatest(posts_count - 1, 0) WHERE id = p.group_id;
  END IF;
  UPDATE public.posts
  SET author_id = NULL, deleted_at = now(), audio_path = NULL, mime = NULL, duration_ms = NULL, title = NULL,
      likes_count = 0, listens_count = 0
  WHERE id = p_post;
END $$;

-- A tombstone goes once nothing hangs under it any more (and so on up the thread).
CREATE FUNCTION private.posts_tombstone_gc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.posts t
  WHERE t.id IN (OLD.reply_to, OLD.repost_of) AND t.deleted_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.posts c WHERE c.reply_to = t.id OR c.repost_of = t.id);
  RETURN OLD;
END $$;
CREATE TRIGGER posts_tombstone_gc AFTER DELETE ON public.posts
  FOR EACH ROW WHEN (OLD.reply_to IS NOT NULL OR OLD.repost_of IS NOT NULL)
  EXECUTE FUNCTION private.posts_tombstone_gc();

-- Account deletion: voices that others answered stay as tombstones; the rest go with the account (cascade).
-- Bottom-up, so your voice above your own reply that someone answered stays too (else the cascade would take it).
CREATE FUNCTION private.profile_deleting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
  n int;
BEGIN
  LOOP
    n := 0;
    FOR r IN
      SELECT p.id FROM public.posts p
      WHERE p.author_id = OLD.id
        AND EXISTS (SELECT 1 FROM public.posts c
                    WHERE c.author_id IS DISTINCT FROM OLD.id   -- someone else's, or already a tombstone
                      AND (c.reply_to = p.id
                           OR (c.repost_of = p.id AND (c.audio_path IS NOT NULL OR c.deleted_at IS NOT NULL))))
    LOOP
      PERFORM private.remove_post(r.id);
      n := n + 1;
    END LOOP;
    EXIT WHEN n = 0;
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER profile_deleting BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.profile_deleting();

-- Your own voice: delete (or tombstone). Replaces the direct DELETE policy.
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE FUNCTION public.delete_post(p_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post AND author_id = uid) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.remove_post(p_post);
END $$;

-- A tombstone shows in its thread (as "deleted") where its group can be seen.
CREATE FUNCTION private.can_see_tombstone(p_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.posts t
                 WHERE t.id = p_post AND t.deleted_at IS NOT NULL AND NOT t.hidden
                   AND (t.group_id IS NULL OR private.can_see_group(auth.uid(), t.group_id)))
$$;

CREATE OR REPLACE FUNCTION public.post_ancestors(p_post uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  ids uuid[];
BEGIN
  WITH RECURSIVE up AS (
    SELECT p.reply_to AS id, 1 AS depth FROM public.posts p WHERE p.id = p_post AND p.reply_to IS NOT NULL
    UNION ALL
    SELECT p.reply_to, up.depth + 1 FROM up JOIN public.posts p ON p.id = up.id
    WHERE p.reply_to IS NOT NULL AND up.depth < 20
  )
  SELECT array_agg(up.id ORDER BY up.depth DESC) INTO ids FROM up
  WHERE private.can_see_post(up.id) OR private.can_see_tombstone(up.id);
  RETURN coalesce(ids, ARRAY[]::uuid[]);
END $$;

-- Feeds: tombstones only in a thread (replies / one / ids), with `deleted`; a quote of a deleted voice stays, with
-- `orig_deleted`.
DROP FUNCTION public.feed_posts(text, text, uuid, uuid, uuid, timestamptz, int, int, uuid[], uuid);
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
  reply_to_username text, group_id uuid, group_name text, deleted boolean, orig_deleted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF p_scope NOT IN ('foryou', 'all', 'following', 'section', 'topic', 'author', 'author_replies', 'replies', 'one', 'ids',
                     'group', 'groups', 'news', 'personal', 'loose') THEN
    RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id, p.created_at, a.id, a.username, a.full_name, a.avatar_path,
         p.section_id, p.topic_id, t.title, p.reply_to, p.repost_of, p.title, p.audio_path,
         p.duration_ms, p.likes_count, p.replies_count, p.reposts_count, p.listens_count,
         EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND l.user_id = uid),
         EXISTS (SELECT 1 FROM public.posts r WHERE r.repost_of = coalesce(CASE WHEN p.audio_path IS NULL THEN p.repost_of END, p.id) AND r.author_id = uid AND r.audio_path IS NULL),
         coalesce(p.author_id = uid, false),
         oa.username, oa.full_name, oa.avatar_path, o.title, o.audio_path, o.duration_ms, o.created_at, o.author_id,
         o.likes_count, o.replies_count, o.reposts_count, o.listens_count,
         ra.username, p.group_id, g.name, p.deleted_at IS NOT NULL, coalesce(o.deleted_at IS NOT NULL, false)
  FROM public.posts p
  LEFT JOIN public.profiles a ON a.id = p.author_id
  LEFT JOIN public.topics t ON t.id = p.topic_id AND NOT t.hidden
  LEFT JOIN public.posts o ON o.id = p.repost_of
  LEFT JOIN public.profiles oa ON oa.id = o.author_id
  LEFT JOIN public.posts rp ON rp.id = p.reply_to
  LEFT JOIN public.profiles ra ON ra.id = rp.author_id
  LEFT JOIN public.groups g ON g.id = p.group_id
  WHERE NOT p.hidden
    AND CASE WHEN p.deleted_at IS NULL THEN NOT a.disabled AND NOT private.is_blocked(uid, p.author_id)
             ELSE p_scope IN ('replies', 'one', 'ids') END
    AND (o.id IS NULL OR o.deleted_at IS NOT NULL
         OR (NOT o.hidden AND NOT oa.disabled AND NOT private.is_blocked(uid, o.author_id)))
    AND (p.group_id IS NULL OR private.can_see_group(uid, p.group_id))
    AND (p_before IS NULL OR p_scope IN ('foryou', 'news', 'one', 'ids')
         OR (CASE WHEN p_scope = 'replies' THEN p.created_at > p_before ELSE p.created_at < p_before END))
    AND CASE p_scope
      WHEN 'foryou' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.audio_path IS NOT NULL AND p.created_at > now() - interval '30 days'
      WHEN 'all' THEN p.group_id IS NULL AND p.reply_to IS NULL
      WHEN 'following' THEN p.group_id IS NULL AND p.reply_to IS NULL AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'section' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id = p_section
      WHEN 'topic' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.topic_id = p_topic
      WHEN 'author' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NULL
      WHEN 'author_replies' THEN p.group_id IS NULL AND p.author_id = p_author AND p.reply_to IS NOT NULL
      WHEN 'news' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL AND p.audio_path IS NOT NULL
                       AND p.created_at > now() - interval '30 days'
      WHEN 'loose' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NOT NULL AND p.topic_id IS NULL
                        AND (o.id IS NULL OR o.topic_id IS NULL)
                        AND (p_section IS NULL OR p.section_id = p_section)
      WHEN 'personal' THEN p.group_id IS NULL AND p.reply_to IS NULL AND p.section_id IS NULL
                           AND (p.author_id = uid OR private.follows(uid, p.author_id))
      WHEN 'group' THEN p.group_id = p_group AND p.reply_to IS NULL
      WHEN 'groups' THEN p.reply_to IS NULL
                         AND p.group_id IN (SELECT m.group_id FROM public.group_members m WHERE m.user_id = uid)
      WHEN 'one' THEN p.id = p_parent
      WHEN 'ids' THEN p.id = ANY (p_ids)
      ELSE p.reply_to = p_parent
    END
  ORDER BY
    CASE WHEN p_scope IN ('foryou', 'news') THEN
      (1 + p.likes_count * 3 + p.replies_count * 4 + p.reposts_count * 5 + p.listens_count)::float8
      * CASE WHEN private.follows(uid, p.author_id) THEN 1.5 ELSE 1 END
      * CASE WHEN p.author_id = uid THEN 0.5 ELSE 1 END
      / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.5)
    END DESC NULLS LAST,
    CASE WHEN p_scope = 'ids' THEN array_position(p_ids, p.id) END ASC NULLS LAST,
    CASE WHEN p_scope = 'replies' THEN p.created_at END ASC NULLS LAST,
    p.created_at DESC
  OFFSET CASE WHEN p_scope IN ('foryou', 'news') THEN least(greatest(coalesce(p_offset, 0), 0), 1000) ELSE 0 END
  LIMIT lim;
END $$;

-- Admin queue: a voice its author deleted (now a tombstone) counts as gone.
CREATE OR REPLACE FUNCTION public.admin_reports(p_open boolean DEFAULT true, p_limit int DEFAULT 100)
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
  ORDER BY CASE WHEN coalesce(p_open, true) THEN r.created_at END ASC,
           r.resolved_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 300);
END $$;

-- Audio no post points at (older than an hour, so a voice being published isn't caught between upload and post).
CREATE FUNCTION public.orphan_voice_files(p_limit int DEFAULT 200)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'voices' AND o.created_at < now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.audio_path = o.name)
  ORDER BY o.created_at
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000)
$$;

REVOKE EXECUTE ON FUNCTION private.remove_post(uuid), private.posts_tombstone_gc(), private.profile_deleting()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- the Worker only (service role)
REVOKE EXECUTE ON FUNCTION public.orphan_voice_files(int) FROM authenticated;
