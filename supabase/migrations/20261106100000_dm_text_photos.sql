-- DMs with text and photos (user request 2026-10-14). A message is a voice (listen once, as before), a text
-- (≤ 1000) or a photo; text and photos stay in the conversation (90 days, like every DM row) and are "read" when the
-- recipient opens the thread. Photos live in the PRIVATE bucket `dm-photos` under the sender's folder; only the two
-- people of the conversation can read them (signed URLs), never across a block.

ALTER TABLE public.voice_messages ALTER COLUMN duration_ms DROP NOT NULL;
ALTER TABLE public.voice_messages
  ADD COLUMN body text CHECK (char_length(body) BETWEEN 1 AND 1000),
  ADD COLUMN image_path text CHECK (char_length(image_path) <= 200);
ALTER TABLE public.voice_messages ADD CONSTRAINT voice_messages_content_check
  CHECK (duration_ms IS NOT NULL OR body IS NOT NULL OR image_path IS NOT NULL);
CREATE INDEX voice_messages_image ON public.voice_messages (image_path) WHERE image_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dm-photos', 'dm-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY dm_photos_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dm-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY dm_photos_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dm-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
-- the sender's own files, or a photo sent in a conversation you are part of (not across a block)
CREATE POLICY dm_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dm-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.voice_messages m
               WHERE m.image_path = name AND auth.uid() IN (m.sender_id, m.recipient_id)
                 AND NOT private.is_blocked(m.sender_id, m.recipient_id))));

-- Text and / or a photo already uploaded to dm-photos/<you>/…; friends only (mutual follows), like voices.
CREATE FUNCTION public.send_dm(p_to uuid, p_body text DEFAULT NULL, p_image text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  mid uuid;
BEGIN
  IF NOT private.are_friends(uid, p_to) OR private.is_blocked(uid, p_to)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to AND NOT disabled) THEN
    RAISE EXCEPTION 'not_friends' USING ERRCODE = '42501';
  END IF;
  IF v_body IS NULL AND p_image IS NULL THEN RAISE EXCEPTION 'empty_post' USING ERRCODE = '22023'; END IF;
  IF char_length(v_body) > 1000 THEN RAISE EXCEPTION 'too_long' USING ERRCODE = '22023'; END IF;
  IF p_image IS NOT NULL AND (NOT starts_with(p_image, uid::text || '/') OR char_length(p_image) > 200
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'dm-photos' AND name = p_image)
     OR EXISTS (SELECT 1 FROM public.voice_messages WHERE image_path = p_image)) THEN
    RAISE EXCEPTION 'file_missing' USING ERRCODE = '22023';
  END IF;
  PERFORM private.rate_limit('voice_message', 30, interval '1 minute');
  PERFORM private.rate_limit('voice_message_day', 500, interval '1 day');
  INSERT INTO public.voice_messages (sender_id, recipient_id, body, image_path)
  VALUES (uid, p_to, v_body, p_image) RETURNING id INTO mid;
  RETURN mid;
END $$;

-- Opening a conversation reads its texts and photos (voices are only "opened" by listening).
CREATE FUNCTION public.read_dm_thread(p_other uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.voice_messages SET opened_at = now()
  WHERE recipient_id = private.me() AND sender_id = p_other AND duration_ms IS NULL AND opened_at IS NULL;
$$;

-- A text / photo has no audio to consume.
DO $patch$
DECLARE def text := pg_get_functiondef('public.consume_voice_message(uuid)'::regprocedure);
BEGIN
  IF position('AND m.opened_at IS NULL AND m.expired_at IS NULL' IN def) = 0 THEN RAISE EXCEPTION 'consume patch'; END IF;
  EXECUTE replace(def, 'AND m.opened_at IS NULL AND m.expired_at IS NULL',
                       'AND m.opened_at IS NULL AND m.expired_at IS NULL AND m.duration_ms IS NOT NULL');
  def := pg_get_functiondef('private.expire_voice_messages()'::regprocedure);
  IF position('WHERE opened_at IS NULL AND expired_at IS NULL AND created_at' IN def) = 0 THEN RAISE EXCEPTION 'expire patch'; END IF;
  -- only unheard VOICES expire after 10 days; texts and photos stay until the 90-day clean-up
  EXECUTE replace(def, 'WHERE opened_at IS NULL AND expired_at IS NULL AND created_at',
                       'WHERE duration_ms IS NOT NULL AND opened_at IS NULL AND expired_at IS NULL AND created_at');
END $patch$;

-- Threads: + what the last message was (voice | text | photo) and its text.
DROP FUNCTION public.my_threads();
CREATE FUNCTION public.my_threads()
RETURNS TABLE(other_id uuid, username text, full_name text, avatar_path text, last_at timestamptz, last_from_me boolean,
              last_state text, unheard int, last_kind text, last_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := private.me();
BEGIN
  RETURN QUERY
  WITH mine AS (
    SELECT m.*, CASE WHEN m.sender_id = uid THEN m.recipient_id ELSE m.sender_id END AS other
    FROM public.voice_messages m WHERE uid IN (m.sender_id, m.recipient_id)
  ), latest AS (
    SELECT DISTINCT ON (other) other, created_at, sender_id = uid AS from_me,
           CASE WHEN opened_at IS NOT NULL THEN 'opened' WHEN expired_at IS NOT NULL THEN 'expired' ELSE 'delivered' END AS state,
           CASE WHEN duration_ms IS NOT NULL THEN 'voice' WHEN image_path IS NOT NULL THEN 'photo' ELSE 'text' END AS kind,
           body
    FROM mine ORDER BY other, created_at DESC
  )
  SELECT p.id, p.username, p.full_name, p.avatar_path, l.created_at, l.from_me, l.state,
         (SELECT count(*)::int FROM mine x
          WHERE x.other = l.other AND x.recipient_id = uid AND x.opened_at IS NULL AND x.expired_at IS NULL),
         l.kind, left(l.body, 120)
  FROM latest l JOIN public.profiles p ON p.id = l.other
  WHERE NOT private.is_blocked(uid, l.other)
  ORDER BY l.created_at DESC;
END $$;

-- dm-photos files no message points at (deleted rows after 90 days, failed sends): the sweeper removes them.
CREATE FUNCTION private.orphan_dm_photos(p_limit int)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'dm-photos' AND o.created_at < now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.voice_messages m WHERE m.image_path = o.name)
  ORDER BY o.created_at
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000)
$$;
REVOKE EXECUTE ON FUNCTION private.orphan_dm_photos(int) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.orphan_dm_photos(p_limit int DEFAULT 200)
RETURNS SETOF text LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM private.orphan_dm_photos(p_limit);
END $$;

REVOKE EXECUTE ON FUNCTION public.send_dm(uuid, text, text), public.read_dm_thread(uuid), public.my_threads(),
  public.orphan_dm_photos(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_dm(uuid, text, text), public.read_dm_thread(uuid), public.my_threads()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orphan_dm_photos(int) TO service_role;
GRANT EXECUTE ON FUNCTION private.orphan_dm_photos(int) TO service_role;
