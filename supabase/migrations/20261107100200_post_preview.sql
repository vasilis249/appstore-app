-- Public share page (user decision 2026-10-15): a shared post link opens a page anyone can see, to bring students in.
-- It shows only a teaser: the author's FIRST name, university / department, the post's text and counts — never the
-- voice, the photos, the surname or the profile photo. Group posts, deleted, hidden (moderation) or disabled
-- authors' posts give nothing. Read through the Worker (service role), like invite_preview.

CREATE FUNCTION private.post_preview(p_post uuid)
RETURNS TABLE (first_name text, university_id text, department_id text, campus boolean, text text,
               duration_ms int, photos int, likes int, replies int, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT split_part(btrim(coalesce(nullif(a.full_name, ''), a.username)), ' ', 1),
         a.university_id, a.department_id, p.university_id IS NOT NULL, p.title,
         p.duration_ms, coalesce(cardinality(p.images), 0), p.likes_count, p.replies_count, p.created_at
  FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
  WHERE p.id = p_post AND p.deleted_at IS NULL AND NOT p.hidden AND NOT a.disabled AND p.group_id IS NULL
    AND NOT p.plain_repost
$$;

CREATE FUNCTION public.post_preview(p_post uuid)
RETURNS TABLE (first_name text, university_id text, department_id text, campus boolean, text text,
               duration_ms int, photos int, likes int, replies int, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM private.post_preview(p_post);
END $$;

REVOKE EXECUTE ON FUNCTION private.post_preview(uuid), public.post_preview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.post_preview(uuid), public.post_preview(uuid) TO service_role;
