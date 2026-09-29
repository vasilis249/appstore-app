-- Username search (prefix), with the relation to the caller. Dots and underscores are optional
-- in the query ("mariapap" finds "maria.papadopoulou").
CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (id uuid, username text, full_name text, avatar_path text, relation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  q text := private.slugify(p_query);
BEGIN
  IF char_length(q) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_path,
         CASE WHEN f.status = 'accepted' THEN 'friends'
              WHEN f.status = 'pending' AND f.requested_by = uid THEN 'outgoing'
              WHEN f.status = 'pending' THEN 'incoming'
              ELSE 'none' END
  FROM public.profiles p
  LEFT JOIN public.friendships f ON f.user_a = least(uid, p.id) AND f.user_b = greatest(uid, p.id)
  WHERE (starts_with(p.username, q) OR starts_with(translate(p.username, '._', ''), translate(q, '._', '')))
    AND p.id <> uid AND NOT p.disabled
    AND NOT private.is_blocked(uid, p.id)
  ORDER BY (p.username = q) DESC, p.username
  LIMIT 20;
END $$;
