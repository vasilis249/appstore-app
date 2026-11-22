-- A push about a post with no text (a voice-only question, like or reply) ended in ": " ("Νίκος ρώτησε: "). The post
-- now reads as 🎙️ in push texts. Patched in place, like the earlier push_job text changes.
DO $$
DECLARE def text := pg_get_functiondef('private.push_job(text, text)'::regprocedure);
        needle text := 'post_title := left(post_title, 100);';
BEGIN
  IF position(needle IN def) = 0 THEN RAISE EXCEPTION 'push_job changed: patch by hand'; END IF;
  EXECUTE replace(def, needle, 'post_title := coalesce(nullif(left(post_title, 100), ''''), ''🎙️'');');
END $$;
