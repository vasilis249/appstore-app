-- News → Όλα: the topic of the day is always the first card. It used to be ordered like any headline (last
-- activity), so on a busy day — 8 feeds adding headlines every 3 hours — an admin's morning pick with few voices
-- slid to a later page and Home never showed it on top.

CREATE OR REPLACE FUNCTION public.news_topics(p_section text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, section_id text, kind text, title text, source_name text, source_url text, image_url text,
               created_at timestamptz, last_post_at timestamptz, posts_count int, speakers_count int, speakers jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  daily uuid := CASE WHEN p_section IS NULL THEN (SELECT d.topic_id FROM public.today() d) END;
BEGIN
  RETURN QUERY
  SELECT t.id, t.section_id, t.kind, t.title, t.source_name, t.source_url, t.image_url, t.created_at, t.last_post_at,
         t.posts_count,
         (SELECT count(DISTINCT p.author_id)::int FROM public.posts p
          WHERE p.topic_id = t.id AND p.reply_to IS NULL AND NOT p.hidden),
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('name', coalesce(nullif(btrim(s.full_name), ''), s.username), 'avatar_path', s.avatar_path) ORDER BY s.last DESC)
           FROM (
             SELECT a.full_name, a.username, a.avatar_path, max(p.created_at) AS last
             FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
             WHERE p.topic_id = t.id AND p.reply_to IS NULL AND NOT p.hidden AND NOT a.disabled
               AND NOT private.is_blocked(uid, a.id)
             GROUP BY a.id, a.full_name, a.username, a.avatar_path
             ORDER BY last DESC LIMIT 3
           ) s), '[]'::jsonb)
  FROM public.topics t
  WHERE NOT t.hidden AND (p_section IS NULL OR t.section_id = p_section)
    AND (t.id = daily OR t.created_at > now() - interval '7 days' OR t.last_post_at > now() - interval '3 days')
  ORDER BY coalesce(t.id = daily, false) DESC, t.pinned DESC,
           greatest(t.created_at, coalesce(t.last_post_at, t.created_at)) DESC, t.id
  LIMIT least(greatest(coalesce(p_limit, 15), 1), 50) OFFSET greatest(coalesce(p_offset, 0), 0);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
