-- Delete ONE account everywhere (Supabase SQL Editor). Set the name below in BOTH steps.
-- Matches the username or the part of the email before the @.

-- STEP 1 — look first: exactly one row should come back, and it should be the right person.
SELECT u.id, u.email, p.username, p.full_name, p.university_id, u.created_at,
       (SELECT count(*) FROM public.posts WHERE author_id = u.id) AS posts,
       (SELECT count(*) FROM public.course_files WHERE uploader_id = u.id) AS course_files,
       (SELECT count(*) FROM storage.objects o WHERE (storage.foldername(o.name))[1] = u.id::text) AS stored_files
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.username = 'ph08680' OR split_part(lower(u.email), '@', 1) = 'ph08680';

-- STEP 2 — delete. Stops without changing anything unless exactly one account matches.
-- Deleting the auth user removes the profile and everything that hangs off it (posts, messages, follows, files'
-- rows, location, push tokens, student email hash …); the school groups left empty go too.
DO $$
DECLARE
  who text := 'ph08680';
  ids uuid[];
  grp uuid[];
BEGIN
  SELECT array_agg(u.id) INTO ids FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.username = who OR split_part(lower(u.email), '@', 1) = who;
  IF coalesce(array_length(ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION '% accounts match %, nothing deleted', coalesce(array_length(ids, 1), 0), who;
  END IF;
  SELECT array_agg(group_id) INTO grp FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id = ids[1] AND g.auto;
  DELETE FROM auth.users WHERE id = ids[1];
  DELETE FROM public.groups g WHERE g.id = ANY (coalesce(grp, '{}')) AND g.auto
    AND NOT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g.id);
  RAISE NOTICE 'deleted account % (% empty school groups removed)', ids[1],
    (SELECT count(*) FROM unnest(coalesce(grp, '{}')) x WHERE NOT EXISTS (SELECT 1 FROM public.groups WHERE id = x));
END $$;

-- STEP 3 — the files (SQL may not delete from Storage): Dashboard → Storage → in each of the buckets voices, avatars,
-- dm-photos, course-files delete the folder named with the id from step 1.
